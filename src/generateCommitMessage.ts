import { OpenAI } from 'openai';
import { getConfig } from './utils/config';
import { getMainCommitPrompt, getCommitMessageFromDiff } from './prompts';
import { getEngine } from './utils/engine';
import { mergeDiffs } from './utils/mergeDiffs';
import { tokenCount } from './utils/tokenCount';
import { DEFAULT_TOKEN_LIMITS } from './types';
import { filterDiff } from './utils/diffFilter';
import { optimizeDiff } from './utils/diffOptimizer';

const ADJUSTMENT_FACTOR = 20;

// Internal function that returns metadata along with the message
const generateCommitMessageByDiffInternal = async (
    diff: string,
    fullGitMojiSpec: boolean = false,
    context: string = ''
): Promise<{ message: string; filteredDiff: string; systemPrompt: Array<OpenAI.Chat.Completions.ChatCompletionMessageParam> }> => {
    try {
        const config = getConfig();
        const MAX_TOKENS_INPUT = config.ACP_TOKENS_MAX_INPUT;
        const MAX_TOKENS_OUTPUT = config.ACP_TOKENS_MAX_OUTPUT;

        // Generate system prompt first (needed for token calculation)
        const INIT_MESSAGES_PROMPT = await getMainCommitPrompt(
            fullGitMojiSpec,
            context
        );

        const INIT_MESSAGES_PROMPT_LENGTH = INIT_MESSAGES_PROMPT.map(
            (msg) => tokenCount(msg.content as string) + 4
        ).reduce((a, b) => a + b, 0);

        const MAX_REQUEST_TOKENS =
            MAX_TOKENS_INPUT -
            ADJUSTMENT_FACTOR -
            INIT_MESSAGES_PROMPT_LENGTH -
            MAX_TOKENS_OUTPUT;

        // Quick check: if diff is small, skip expensive filtering/optimization
        const quickTokenEstimate = Math.ceil(diff.length / 4); // Rough approximation
        
        let filteredDiff: string;
        if (quickTokenEstimate < MAX_REQUEST_TOKENS * 0.5) {
            // Small diff - only do basic filtering, skip optimization
            filteredDiff = await filterDiff(diff);
        } else {
            // Large diff - do full filtering and optimization
            filteredDiff = await filterDiff(diff);
            filteredDiff = optimizeDiff(filteredDiff);
        }
        
        if (!filteredDiff || filteredDiff.trim().length === 0) {
            throw new Error('No relevant changes to commit after filtering');
        }

        // If diff is too large, split it
        const filteredTokenCount = tokenCount(filteredDiff);
        if (filteredTokenCount >= MAX_REQUEST_TOKENS) {
            const commitMessagePromises = await getCommitMsgsPromisesFromFileDiffs(
                filteredDiff,
                MAX_REQUEST_TOKENS,
                INIT_MESSAGES_PROMPT
            );

            // Execute all API calls in parallel
            const commitMessages = await Promise.all(commitMessagePromises);
            
            return commitMessages.filter((msg): msg is string => msg !== null && msg !== undefined).join('\n\n');
        }

        // Generate commit message for the whole diff
        const messages: Array<OpenAI.Chat.Completions.ChatCompletionMessageParam> = [
            ...INIT_MESSAGES_PROMPT,
            {
                role: 'user',
                content: getCommitMessageFromDiff(filteredDiff)
            }
        ];

        const engine = getEngine();
        const commitMessage = await engine.generateCommitMessage(messages);

        if (!commitMessage) {
            throw new Error('Failed to generate commit message');
        }

        return {
            message: commitMessage,
            filteredDiff,
            systemPrompt: INIT_MESSAGES_PROMPT
        };
    } catch (error) {
        throw error;
    }
};

// Public API - returns just the message
export const generateCommitMessageByDiff = async (
    diff: string,
    fullGitMojiSpec: boolean = false,
    context: string = ''
): Promise<string> => {
    const result = await generateCommitMessageByDiffInternal(diff, fullGitMojiSpec, context);
    return result.message;
};

// Public API - returns message with metadata
export const generateCommitMessageByDiffWithMetadata = generateCommitMessageByDiffInternal;


const getCommitMsgsPromisesFromFileDiffs = async (
    diff: string,
    maxDiffLength: number,
    systemPrompt: Array<OpenAI.Chat.Completions.ChatCompletionMessageParam>
): Promise<Array<Promise<string | null | undefined>>> => {
    const separator = 'diff --git ';
    const diffByFiles = diff.split(separator).slice(1);

    // Merge multiple files-diffs into 1 prompt to save tokens
    const mergedFilesDiffs = mergeDiffs(diffByFiles, maxDiffLength);

    const commitMessagePromises: Promise<string | null | undefined>[] = [];
    const engine = getEngine();

    for (const fileDiff of mergedFilesDiffs) {
        // Reuse the system prompt and only add the diff as user message
        const messages: Array<OpenAI.Chat.Completions.ChatCompletionMessageParam> = [
            ...systemPrompt,
            {
                role: 'user',
                content: getCommitMessageFromDiff(separator + fileDiff)
            }
        ];

        commitMessagePromises.push(engine.generateCommitMessage(messages));
    }

    return commitMessagePromises;
};

