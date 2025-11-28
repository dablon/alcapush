import { getConfig } from './config';
import { AiEngine, AIProvider } from '../types';
import { OpenAiEngine } from '../engine/openai';
import { AnthropicEngine } from '../engine/anthropic';
import { GeminiEngine } from '../engine/gemini';
import { OllamaEngine } from '../engine/ollama';

export const parseCustomHeaders = (
    headers: any
): Record<string, string> => {
    let parsedHeaders = {};

    if (!headers) {
        return parsedHeaders;
    }

    try {
        if (typeof headers === 'object' && !Array.isArray(headers)) {
            parsedHeaders = headers;
        } else {
            parsedHeaders = JSON.parse(headers);
        }
    } catch (error) {
        console.warn(
            'Invalid ACP_API_CUSTOM_HEADERS format, ignoring custom headers'
        );
    }

    return parsedHeaders;
};

export const getEngine = (): AiEngine => {
    const config = getConfig();
    const provider = config.ACP_AI_PROVIDER;

    const customHeaders = parseCustomHeaders(config.ACP_API_CUSTOM_HEADERS);

    const DEFAULT_CONFIG = {
        model: config.ACP_MODEL!,
        maxTokensOutput: config.ACP_TOKENS_MAX_OUTPUT!,
        maxTokensInput: config.ACP_TOKENS_MAX_INPUT!,
        baseURL: config.ACP_API_URL!,
        apiKey: config.ACP_API_KEY!,
        customHeaders
    };

    switch (provider) {
        case AIProvider.OLLAMA:
            return new OllamaEngine(DEFAULT_CONFIG);

        case AIProvider.ANTHROPIC:
            return new AnthropicEngine(DEFAULT_CONFIG);

        case AIProvider.GEMINI:
            return new GeminiEngine(DEFAULT_CONFIG);

        case AIProvider.AZURE:
            // For now, Azure uses the same OpenAI engine
            return new OpenAiEngine(DEFAULT_CONFIG);

        default:
            return new OpenAiEngine(DEFAULT_CONFIG);
    }
};
