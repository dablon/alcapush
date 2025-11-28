import { OpenAI } from 'openai';
import { getConfig } from './utils/config';
import { getMainCommitPrompt, getCommitMessageFromDiff } from './prompts';
import { getEngine } from './utils/engine';
import { mergeDiffs } from './utils/mergeDiffs';
import { tokenCount } from './utils/tokenCount';
import { DEFAULT_TOKEN_LIMITS } from './types';

const ADJUSTMENT_FACTOR = 20;

export const generateCommitMessageByDiff = async (
    diff: string,
    fullGitMojiSpec: boolean = false,
    context: string = ''
): Promise<string> => {
    try {
        const config = getConfig();
        const MAX_TOKENS_INPUT = config.ACP_TOKENS_MAX_INPUT;
        const MAX_TOKENS_OUTPUT = config.ACP_TOKENS_MAX_OUTPUT;

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

        // If diff is too large, split it
        if (tokenCount(diff) >= MAX_REQUEST_TOKENS) {
            const commitMessagePromises = await getCommitMsgsPromisesFromFileDiffs(
                diff,
                MAX_REQUEST_TOKENS,
                fullGitMojiSpec,
                context
            );

            const commitMessages: string[] = [];
            for (const promise of commitMessagePromises) {
                const msg = await promise;
                if (msg) commitMessages.push(msg);
                await delay(1000); // Rate limiting
            }

            return commitMessages.join('\n\n');
        }

        // Generate commit message for the whole diff
        const messages = await generateCommitMessageChatCompletionPrompt(
            diff,
            fullGitMojiSpec,
            context
        );

        const engine = getEngine();
        const commitMessage = await engine.generateCommitMessage(messages);

        if (!commitMessage) {
            throw new Error('Failed to generate commit message');
        }

        return commitMessage;
    } catch (error) {
        throw error;
    }
};

const generateCommitMessageChatCompletionPrompt = async (
    diff: string,
    fullGitMojiSpec: boolean,
    context: string
): Promise<Array<OpenAI.Chat.Completions.ChatCompletionMessageParam>> => {
    const INIT_MESSAGES_PROMPT = await getMainCommitPrompt(
        fullGitMojiSpec,
        context
    );

    const chatContextAsCompletionRequest = [...INIT_MESSAGES_PROMPT];

    chatContextAsCompletionRequest.push({
        role: 'user',
        content: getCommitMessageFromDiff(diff)
    });

    return chatContextAsCompletionRequest;
};

const getCommitMsgsPromisesFromFileDiffs = async (
    diff: string,
    maxDiffLength: number,
    fullGitMojiSpec: boolean,
    context: string
): Promise<Array<Promise<string | null | undefined>>> => {
    const separator = 'diff --git ';
    const diffByFiles = diff.split(separator).slice(1);

    // Merge multiple files-diffs into 1 prompt to save tokens
    const mergedFilesDiffs = mergeDiffs(diffByFiles, maxDiffLength);

    const commitMessagePromises: Promise<string | null | undefined>[] = [];

    for (const fileDiff of mergedFilesDiffs) {
        const messages = await generateCommitMessageChatCompletionPrompt(
            separator + fileDiff,
            fullGitMojiSpec,
            context
        );

        const engine = getEngine();
        commitMessagePromises.push(engine.generateCommitMessage(messages));
    }

    return commitMessagePromises;
};

const delay = (ms: number): Promise<void> => {
    return new Promise((resolve) => setTimeout(resolve, ms));
};
