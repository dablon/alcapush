import { OpenAI } from 'openai';
import { getConfig } from './utils/config';
import { getMainCommitPrompt, getCommitMessageFromDiff } from './prompts';
import { getEngine } from './utils/engine';
import { mergeDiffs } from './utils/mergeDiffs';
import { tokenCount } from './utils/tokenCount';
import { filterDiff } from './utils/diffFilter';

const ADJUSTMENT_FACTOR = 20;

/**
 * Truncates diff content to fit within the specified token limit
 * Tries to preserve complete files by truncating from the end
 * Uses a conservative approach to ensure we stay well under the limit
 */
const truncateDiffByTokens = (diff: string, maxTokens: number): string => {
    if (maxTokens <= 0) {
        return '... (truncated due to token limit)';
    }
    
    const TRUNCATION_BUFFER = 50; // Leave 50 tokens as buffer for truncation marker
    const effectiveMaxTokens = Math.max(0, maxTokens - TRUNCATION_BUFFER);
    
    const diffTokens = tokenCount(diff);
    if (diffTokens <= effectiveMaxTokens) {
        return diff;
    }

    // Try to truncate by files first (preserve complete files)
    const separator = 'diff --git ';
    const fileDiffs = diff.split(separator);
    
    if (fileDiffs.length > 1) {
        // First part is empty or header, skip it
        const actualFiles = fileDiffs.slice(1);
        let truncated = '';
        let currentTokens = 0;
        
        // Add files from the beginning until we hit the limit
        for (const fileDiff of actualFiles) {
            const fileDiffWithSeparator = separator + fileDiff;
            const fileTokens = tokenCount(fileDiffWithSeparator);
            
            // Use 90% of remaining tokens to be conservative
            const remainingTokens = effectiveMaxTokens - currentTokens;
            const conservativeLimit = Math.floor(remainingTokens * 0.9);
            
            if (fileTokens <= conservativeLimit) {
                truncated += (truncated ? '\n' : '') + fileDiffWithSeparator;
                currentTokens += fileTokens;
            } else {
                // If adding the whole file would exceed, try to truncate the last file
                if (remainingTokens > 100) { // Only truncate if we have meaningful space left
                    // Truncate the file diff by lines
                    const lines = fileDiff.split('\n');
                    let truncatedFile = '';
                    let fileTokenCount = tokenCount(separator);
                    
                    for (const line of lines) {
                        const lineTokens = tokenCount(line + '\n');
                        // Use 90% of remaining tokens for this line
                        const lineLimit = Math.floor(remainingTokens * 0.9);
                        if (fileTokenCount + lineTokens <= lineLimit) {
                            truncatedFile += (truncatedFile ? '\n' : '') + line;
                            fileTokenCount += lineTokens;
                        } else {
                            break;
                        }
                    }
                    
                    if (truncatedFile) {
                        truncated += (truncated ? '\n' : '') + separator + truncatedFile;
                        truncated += '\n\n... (truncated due to token limit)';
                    }
                }
                break;
            }
        }
        
        if (truncated) {
            // Final validation - ensure we're actually under the limit
            const finalTokens = tokenCount(truncated);
            if (finalTokens > effectiveMaxTokens) {
                // Still over limit, truncate more aggressively using binary search
                return truncateDiffByBinarySearch(truncated, effectiveMaxTokens);
            }
            return truncated;
        }
    }
    
    // Fallback: truncate by binary search to find the exact cutoff point
    return truncateDiffByBinarySearch(diff, effectiveMaxTokens);
};

/**
 * Truncates text using binary search to find the exact token limit
 */
const truncateDiffByBinarySearch = (text: string, maxTokens: number): string => {
    if (tokenCount(text) <= maxTokens) {
        return text;
    }
    
    // Binary search for the right length
    let left = 0;
    let right = text.length;
    let bestLength = 0;
    
    while (left <= right) {
        const mid = Math.floor((left + right) / 2);
        const truncated = text.substring(0, mid);
        const tokens = tokenCount(truncated);
        
        if (tokens <= maxTokens) {
            bestLength = mid;
            left = mid + 1;
        } else {
            right = mid - 1;
        }
    }
    
    if (bestLength === 0) {
        return '... (truncated due to token limit)';
    }
    
    // Find the last newline before the cutoff to avoid cutting in the middle of a line
    const lastNewline = text.lastIndexOf('\n', bestLength);
    const finalLength = lastNewline > 0 ? lastNewline : bestLength;
    
    return text.substring(0, finalLength) + '\n\n... (truncated due to token limit)';
};

/**
 * Validates and truncates messages array to ensure it fits within token limits
 * Uses a safety margin to ensure we're well under the limit
 */
const validateAndTruncateMessages = (
    messages: Array<OpenAI.Chat.Completions.ChatCompletionMessageParam>,
    maxTokensInput: number
): Array<OpenAI.Chat.Completions.ChatCompletionMessageParam> => {
    const SAFETY_MARGIN = 100; // Leave 100 tokens as safety margin
    const effectiveMaxTokens = maxTokensInput - SAFETY_MARGIN;
    
    // Calculate total tokens
    const calculateTotalTokens = (msgs: Array<OpenAI.Chat.Completions.ChatCompletionMessageParam>): number => {
        let total = 0;
        for (const msg of msgs) {
            const content = msg.content as string;
            if (content) {
                total += tokenCount(content) + 4; // +4 for message overhead
            }
        }
        return total;
    };
    
    let totalTokens = calculateTotalTokens(messages);
    
    // If within limit (with safety margin), return as is
    if (totalTokens <= effectiveMaxTokens) {
        return messages;
    }
    
    // Need to truncate - find the user message (usually the last one with diff)
    const truncatedMessages = [...messages];
    const userMessageIndex = truncatedMessages.findIndex(msg => msg.role === 'user');
    
    if (userMessageIndex < 0) {
        // No user message found, can't truncate
        if (totalTokens > maxTokensInput) {
            throw new Error(`Request too large: ${totalTokens} tokens exceeds limit of ${maxTokensInput} tokens`);
        }
        return messages;
    }
    
    // Calculate system tokens (all messages except user message)
    const systemMessages = truncatedMessages.filter((_, idx) => idx !== userMessageIndex);
    const systemTokens = calculateTotalTokens(systemMessages);
    
    if (systemTokens > effectiveMaxTokens) {
        throw new Error(`Request too large: system prompt (${systemTokens} tokens) exceeds available limit (${maxTokensInput} tokens)`);
    }
    
    const userMessage = truncatedMessages[userMessageIndex];
    const userContent = userMessage.content as string;
    
    // Calculate available tokens for user content (with safety margin)
    const availableTokens = effectiveMaxTokens - systemTokens;
    
    if (availableTokens <= 0) {
        throw new Error(`Request too large: no tokens available for diff content after system prompt`);
    }
    
    // Iteratively truncate until we're under the limit
    // This ensures we handle any token counting discrepancies
    let truncatedUserContent = userContent;
    let iterations = 0;
    const maxIterations = 5; // Prevent infinite loops
    
    while (iterations < maxIterations) {
        // Update the user message with current content
        truncatedMessages[userMessageIndex] = {
            ...userMessage,
            content: truncatedUserContent
        };
        
        // Check total tokens - must be under the actual limit (not just effective)
        const currentTotalTokens = calculateTotalTokens(truncatedMessages);
        
        if (currentTotalTokens <= effectiveMaxTokens) {
            // We're good! Double-check we're under the actual limit too
            if (currentTotalTokens <= maxTokensInput) {
                break;
            }
            // If somehow we're over the actual limit but under effective, truncate a bit more
        }
        
        // Still over limit, need to truncate more
        const overage = currentTotalTokens - effectiveMaxTokens;
        const currentUserTokens = tokenCount(truncatedUserContent) + 4;
        
        // Calculate new limit: reduce by overage plus extra buffer
        const newUserTokenLimit = Math.max(0, currentUserTokens - overage - 50);
        
        if (newUserTokenLimit <= 0) {
            // Can't truncate further, throw error
            throw new Error(
                `Request too large: cannot truncate further. System prompt uses ${systemTokens} tokens, ` +
                `leaving only ${availableTokens} tokens for diff, but need ${currentUserTokens} tokens. ` +
                `Please increase ACP_TOKENS_MAX_INPUT or reduce the diff size.`
            );
        }
        
        // Extract the diff from the prompt and truncate it
        const diffMatch = truncatedUserContent.match(/Here is the git diff showing changes across multiple files:\n\n([\s\S]*?)\n\nGenerate a comprehensive commit message/);
        
        if (diffMatch && diffMatch[1]) {
            const originalDiff = diffMatch[1];
            // Calculate how much the prompt wrapper uses
            const promptWithoutDiff = truncatedUserContent.replace(diffMatch[1], '');
            const promptWrapperTokens = tokenCount(promptWithoutDiff);
            const diffAvailableTokens = Math.max(0, newUserTokenLimit - promptWrapperTokens - 20);
            
            const truncatedDiff = truncateDiffByTokens(originalDiff, diffAvailableTokens);
            truncatedUserContent = truncatedUserContent.replace(diffMatch[1], truncatedDiff);
        } else {
            // Fallback: truncate the entire user content
            truncatedUserContent = truncateDiffByTokens(truncatedUserContent, newUserTokenLimit);
        }
        
        iterations++;
    }
    
    // Final check - if still over limit after iterations, use binary search as last resort
    truncatedMessages[userMessageIndex] = {
        ...userMessage,
        content: truncatedUserContent
    };
    
    const finalTotalTokens = calculateTotalTokens(truncatedMessages);
    if (finalTotalTokens > maxTokensInput) {
        // Last resort: truncate the entire user message using binary search
        // Calculate how much we need to reduce the user content
        const overage = finalTotalTokens - effectiveMaxTokens;
        const currentUserContentTokens = tokenCount(truncatedUserContent);
        // Need to reduce by overage plus extra buffer, but don't include the +4 overhead in the limit
        const finalUserContentTokenLimit = Math.max(0, currentUserContentTokens - overage - 100);
        
        truncatedUserContent = truncateDiffByBinarySearch(truncatedUserContent, finalUserContentTokenLimit);
        truncatedMessages[userMessageIndex] = {
            ...userMessage,
            content: truncatedUserContent
        };
        
        // One more validation - if still over, we've done our best
        const veryFinalTotalTokens = calculateTotalTokens(truncatedMessages);
        if (veryFinalTotalTokens > maxTokensInput) {
            // This should be extremely rare, but if it happens, throw a clear error
            throw new Error(
                `Request too large: After aggressive truncation, still ${veryFinalTotalTokens} tokens (limit: ${maxTokensInput}). ` +
                `System prompt uses ${systemTokens} tokens. Please increase ACP_TOKENS_MAX_INPUT.`
            );
        }
    }
    
    return truncatedMessages;
};

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

        // Only filter if diff is large enough to potentially have irrelevant files
        // But always ensure we keep all relevant source files
        let filteredDiff: string;
        if (diff.length < 5000) {
            // Very small diff - skip filtering entirely to preserve all files
            filteredDiff = diff;
        } else {
            // Do basic filtering (only remove truly irrelevant files like node_modules, binaries)
            // Skip optimization to preserve all file information
            filteredDiff = await filterDiff(diff);
        }
        
        if (!filteredDiff || filteredDiff.trim().length === 0) {
            throw new Error('No relevant changes to commit after filtering');
        }

        // Use approximation first to check if splitting is needed (faster)
        const filteredTokenEstimate = Math.ceil(filteredDiff.length / 4);
        let needsSplitting = false;
        let filteredTokenCount = 0;
        
        if (filteredTokenEstimate >= MAX_REQUEST_TOKENS * 0.9) {
            // Only do expensive token counting if approximation suggests we're close to limit
            filteredTokenCount = tokenCount(filteredDiff);
            needsSplitting = filteredTokenCount >= MAX_REQUEST_TOKENS;
        } else {
            // Use approximation - we're well under the limit
            needsSplitting = false;
        }
        
        if (needsSplitting) {
            const commitMessagePromises = await getCommitMsgsPromisesFromFileDiffs(
                filteredDiff,
                MAX_REQUEST_TOKENS,
                INIT_MESSAGES_PROMPT
            );

            // Execute all API calls in parallel
            const commitMessages = await Promise.all(commitMessagePromises);
            const message = commitMessages.filter((msg): msg is string => msg !== null && msg !== undefined).join('\n\n');
            
            return {
                message,
                filteredDiff,
                systemPrompt: INIT_MESSAGES_PROMPT
            };
        }

        // Generate commit message for the whole diff
        let messages: Array<OpenAI.Chat.Completions.ChatCompletionMessageParam> = [
            ...INIT_MESSAGES_PROMPT,
            {
                role: 'user',
                content: getCommitMessageFromDiff(filteredDiff)
            }
        ];

        // Validate and truncate messages to ensure they fit within token limits
        messages = validateAndTruncateMessages(messages, MAX_TOKENS_INPUT);

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

    const config = getConfig();
    const MAX_TOKENS_INPUT = config.ACP_TOKENS_MAX_INPUT;

    for (const fileDiff of mergedFilesDiffs) {
        // Reuse the system prompt and only add the diff as user message
        let messages: Array<OpenAI.Chat.Completions.ChatCompletionMessageParam> = [
            ...systemPrompt,
            {
                role: 'user',
                content: getCommitMessageFromDiff(separator + fileDiff)
            }
        ];

        // Validate and truncate messages to ensure they fit within token limits
        messages = validateAndTruncateMessages(messages, MAX_TOKENS_INPUT);

        commitMessagePromises.push(engine.generateCommitMessage(messages));
    }

    return commitMessagePromises;
};

