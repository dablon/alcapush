import { OpenAI } from 'openai';

export interface AiEngineConfig {
    apiKey: string;
    model: string;
    maxTokensOutput: number;
    maxTokensInput: number;
    baseURL?: string;
    customHeaders?: Record<string, string>;
}

export interface AiEngine {
    config: AiEngineConfig;
    generateCommitMessage(
        messages: Array<OpenAI.Chat.Completions.ChatCompletionMessageParam>
    ): Promise<string | null | undefined>;
}

export enum AIProvider {
    OPENAI = 'openai',
    ANTHROPIC = 'anthropic',
    GEMINI = 'gemini',
    AZURE = 'azure',
    OLLAMA = 'ollama'
}

export interface alcapushConfig {
    ACP_API_KEY?: string;
    ACP_AI_PROVIDER?: AIProvider;
    ACP_MODEL?: string;
    ACP_TOKENS_MAX_INPUT?: number;
    ACP_TOKENS_MAX_OUTPUT?: number;
    ACP_EMOJI?: boolean;
    ACP_LANGUAGE?: string;
    ACP_DESCRIPTION?: boolean;
    ACP_API_URL?: string;
    ACP_API_CUSTOM_HEADERS?: string | Record<string, string>;
    ACP_ONE_LINE_COMMIT?: boolean;
    ACP_MESSAGE_TEMPLATE_PLACEHOLDER?: string;
}

export interface CommitFlags {
    yes?: boolean;
    context?: string;
    fgm?: boolean;
}

export const DEFAULT_TOKEN_LIMITS = {
    DEFAULT_MAX_TOKENS_INPUT: 4096,
    DEFAULT_MAX_TOKENS_OUTPUT: 500
};

export const DEFAULT_CONFIG: Partial<alcapushConfig> = {
    ACP_AI_PROVIDER: AIProvider.OPENAI,
    ACP_MODEL: 'gpt-5-nano', // Will fallback to gpt-4o-mini if not available
    ACP_TOKENS_MAX_INPUT: DEFAULT_TOKEN_LIMITS.DEFAULT_MAX_TOKENS_INPUT,
    ACP_TOKENS_MAX_OUTPUT: DEFAULT_TOKEN_LIMITS.DEFAULT_MAX_TOKENS_OUTPUT,
    ACP_EMOJI: false,
    ACP_LANGUAGE: 'en',
    ACP_DESCRIPTION: false,
    ACP_ONE_LINE_COMMIT: false,
    ACP_MESSAGE_TEMPLATE_PLACEHOLDER: '$msg'
};
