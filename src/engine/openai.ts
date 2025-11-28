import { OpenAI } from 'openai';
import axios from 'axios';
import { AiEngine, AiEngineConfig } from '../types';
import { tokenCount } from '../utils/tokenCount';

export class OpenAiEngine implements AiEngine {
    config: AiEngineConfig;
    client: OpenAI;

    constructor(config: AiEngineConfig) {
        this.config = config;

        const clientOptions: OpenAI.ClientOptions = {
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
        const params: OpenAI.Chat.Completions.ChatCompletionCreateParams = {
            model: this.config.model,
            messages,
            temperature: 0,
            top_p: 0.1,
            max_tokens: this.config.maxTokensOutput
        };

        try {
            const REQUEST_TOKENS = messages
                .map((msg) => tokenCount(msg.content as string) + 4)
                .reduce((a, b) => a + b, 0);

            if (
                REQUEST_TOKENS >
                this.config.maxTokensInput - this.config.maxTokensOutput
            ) {
                throw new Error('Too many tokens in request');
            }

            const completion = await this.client.chat.completions.create(params);
            const message = completion.choices[0].message;
            return message?.content || null;
        } catch (error) {
            const err = error as Error;

            // Handle GPT-5-nano not available error - fallback to gpt-4o-mini
            if (err.message?.includes('model') && this.config.model === 'gpt-5-nano') {
                console.warn('⚠️  GPT-5-nano not available yet, falling back to gpt-4o-mini');
                this.config.model = 'gpt-4o-mini';
                return this.generateCommitMessage(messages);
            }

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
}
