import { OpenAI } from 'openai';
import axios from 'axios';
import { AiEngine, AiEngineConfig } from '../types';
import { tokenCount } from '../utils/tokenCount';

export class MiniMaxEngine implements AiEngine {
    config: AiEngineConfig;
    client: OpenAI;

    constructor(config: AiEngineConfig) {
        this.config = config;

        const clientOptions: any = {
            apiKey: config.apiKey
        };

        // MiniMax API base URL
        if (config.baseURL) {
            clientOptions.baseURL = config.baseURL;
        } else {
            clientOptions.baseURL = 'https://api.minimax.chat/v1';
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
            model: this.config.model || 'MiniMax-Text-01',
            messages,
            temperature: 0,
            top_p: 0.1,
            max_tokens: this.config.maxTokensOutput
        };

        try {
            // Final safety check: validate token count before sending to API
            let totalTokens = 0;
            for (const msg of messages) {
                const content = msg.content as string;
                if (content) {
                    totalTokens += tokenCount(content) + 4; // +4 for message overhead
                }
            }

            if (totalTokens > this.config.maxTokensInput) {
                throw new Error(
                    `Request too large: ${totalTokens} tokens exceeds limit of ${this.config.maxTokensInput} tokens. ` +
                    `Please reduce the diff size or increase ACP_TOKENS_MAX_INPUT.`
                );
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
                const minimaxError = error.response.data.error;
                if (minimaxError) throw new Error(minimaxError.message);
            }

            throw err;
        }
    };
}