import { getConfig } from './config';
import { getMainCommitPrompt, getCommitMessageFromDiff } from '../prompts';
import { tokenCount } from './tokenCount';
import { AIProvider } from '../types';

export interface CostEstimate {
    inputTokens: number;
    outputTokens: number;
    estimatedCost: number;
    costCurrency: string;
}

// Pricing per 1M tokens (as of common pricing, approximate)
const PRICING: Record<string, { input: number; output: number }> = {
    // OpenAI models
    'gpt-4o': { input: 2.5, output: 10 },
    'gpt-4o-mini': { input: 0.15, output: 0.6 },
    'gpt-4-turbo': { input: 10, output: 30 },
    'gpt-4': { input: 30, output: 60 },
    'gpt-3.5-turbo': { input: 0.5, output: 1.5 },
    'gpt-5-nano': { input: 0.1, output: 0.4 }, // Approximate
    
    // Anthropic models
    'claude-3-5-sonnet-20241022': { input: 3, output: 15 },
    'claude-3-opus-20240229': { input: 15, output: 75 },
    'claude-3-sonnet-20240229': { input: 3, output: 15 },
    'claude-3-haiku-20240307': { input: 0.25, output: 1.25 },
    
    // Gemini models
    'gemini-pro': { input: 0.5, output: 1.5 },
    'gemini-1.5-pro': { input: 1.25, output: 5 },
    'gemini-1.5-flash': { input: 0.075, output: 0.3 },
};

const DEFAULT_PRICING = { input: 1, output: 3 }; // Fallback pricing

export const estimateCost = async (
    diff: string,
    fullGitMojiSpec: boolean = false,
    context: string = ''
): Promise<CostEstimate> => {
    const config = getConfig();
    const provider = config.ACP_AI_PROVIDER || AIProvider.OPENAI;
    const model = config.ACP_MODEL || 'gpt-5-nano';
    const maxOutputTokens = config.ACP_TOKENS_MAX_OUTPUT || 500;

    // Calculate input tokens
    const initMessagesPrompt = await getMainCommitPrompt(fullGitMojiSpec, context);
    const initPromptTokens = initMessagesPrompt
        .map((msg) => tokenCount(msg.content as string) + 4)
        .reduce((a, b) => a + b, 0);
    
    const diffPrompt = getCommitMessageFromDiff(diff);
    const diffTokens = tokenCount(diffPrompt);
    
    const inputTokens = initPromptTokens + diffTokens;
    const outputTokens = maxOutputTokens; // We'll use max as estimate

    // Calculate cost
    let estimatedCost = 0;
    let costCurrency = '$';

    if (provider === AIProvider.OLLAMA) {
        // Ollama is typically free (local)
        estimatedCost = 0;
    } else {
        // Get pricing for the model
        const modelKey = model.toLowerCase();
        const pricing = PRICING[modelKey] || DEFAULT_PRICING;
        
        // Calculate cost: (inputTokens / 1M) * inputPrice + (outputTokens / 1M) * outputPrice
        const inputCost = (inputTokens / 1_000_000) * pricing.input;
        const outputCost = (outputTokens / 1_000_000) * pricing.output;
        estimatedCost = inputCost + outputCost;
    }

    return {
        inputTokens,
        outputTokens,
        estimatedCost,
        costCurrency
    };
};

