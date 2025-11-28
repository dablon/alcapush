import { OpenAI } from 'openai';
import axios from 'axios';
import { AiEngine, AiEngineConfig } from '../types';

export class OpenAiEngine implements AiEngine {
    config: AiEngineConfig;
    client: OpenAI;

    constructor(config: AiEngineConfig) {
        this.config = config;

        const clientOptions: any = {
            apiKey: config.apiKey
        };

        if (config.baseURL) {
            clientOptions.baseURL = config.baseURL;
        }

        if (config.customHeaders) {
            clientOptions.defaultHeaders = config.customHeaders;
        }

        this.client = new OpenAI(clientOptions);
    }

    public generateCommitMessage = async (
        messages: Array<OpenAI.Chat.Completions.ChatCompletionMessageParam>
    ): Promise<string | null> => {
        // GPT-5-nano uses a different API endpoint
        if (this.config.model === 'gpt-5-nano') {
            return this.generateWithGpt5Nano(messages);
        }

        const params: OpenAI.Chat.Completions.ChatCompletionCreateParams = {
            model: this.config.model,
            messages,
            temperature: 0,
            top_p: 0.1,
            max_tokens: this.config.maxTokensOutput
        };

        try {
            // Skip token counting here - it's already done before calling this function
            // Only do a quick length check as a safety measure
            const totalLength = messages
                .map((msg) => (msg.content as string)?.length || 0)
                .reduce((a, b) => a + b, 0);
            
            // Quick approximation: if text is way too large, reject early
            if (totalLength > this.config.maxTokensInput * 4) {
                throw new Error('Request too large');
            }

            const completion = await this.client.chat.completions.create(params);
            const message = completion.choices[0].message;
            return message?.content || null;
        } catch (error) {
            const err = error as Error;

            if (
                axios.isAxiosError<{ error?: { message: string } }>(error) &&
                error.response?.status === 401
            ) {
                const openAiError = error.response.data.error;
                if (openAiError) throw new Error(openAiError.message);
            }

            throw err;
        }
    };

    private generateWithGpt5Nano = async (
        messages: Array<OpenAI.Chat.Completions.ChatCompletionMessageParam>
    ): Promise<string | null> => {
        try {
            // Skip token counting here - it's already done before calling this function
            // Only do a quick length check as a safety measure
            const totalLength = messages
                .map((msg) => (msg.content as string)?.length || 0)
                .reduce((a, b) => a + b, 0);
            
            // Quick approximation: if text is way too large, reject early
            if (totalLength > this.config.maxTokensInput * 4) {
                throw new Error('Request too large');
            }

            // Convert messages to GPT-5-nano format
            const input = messages.map((msg) => {
                let content = '';
                if (typeof msg.content === 'string') {
                    content = msg.content;
                } else if (Array.isArray(msg.content)) {
                    content = msg.content.map(c => {
                        if (typeof c === 'string') return c;
                        if (typeof c === 'object' && 'text' in c) return (c as any).text || '';
                        return '';
                    }).join('');
                }

                return {
                    role: msg.role,
                    content: [
                        {
                            type: 'input_text',
                            text: content
                        }
                    ]
                };
            });

            // Use OpenAI SDK's responses.create() method
            const response = await (this.client as any).responses.create({
                model: 'gpt-5-nano',
                input,
                text: {
                    format: {
                        type: 'text'
                    },
                    verbosity: 'low' // Lower verbosity for faster responses
                },
                reasoning: {
                    effort: 'low', // Lower reasoning effort for faster responses
                    summary: 'auto'
                },
                tools: [],
                store: false, // Don't store to save time
                include: [] // Skip unnecessary includes to reduce processing
            });

            // Extract response from GPT-5-nano format
            // The response has an 'output' array containing the assistant's message
            // There's also a direct 'output_text' property at the root level (preferred)
            
            // First, check the direct output_text property (simplest and most reliable)
            if (response?.output_text && typeof response.output_text === 'string') {
                return response.output_text;
            }

            // Check the output array for the assistant message
            if (response?.output && Array.isArray(response.output)) {
                for (const item of response.output) {
                    // Look for message type with assistant role
                    if (item?.type === 'message' && item?.role === 'assistant' && item.content) {
                        if (Array.isArray(item.content)) {
                            for (const contentItem of item.content) {
                                if (contentItem?.type === 'output_text' && contentItem.text) {
                                    return contentItem.text;
                                }
                            }
                        }
                    }
                }
            }

            return null;
        } catch (error) {
            const err = error as Error;

            if (
                axios.isAxiosError<{ error?: { message: string } }>(error) &&
                error.response?.status === 401
            ) {
                const openAiError = error.response.data?.error;
                if (openAiError) throw new Error(openAiError.message);
                throw new Error('Invalid API key');
            }

            // Handle OpenAI SDK errors
            if (error && typeof error === 'object' && 'message' in error) {
                throw new Error(err.message);
            }

            throw err;
        }
    };
}
