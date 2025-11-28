import axios, { AxiosInstance } from 'axios';
import { AiEngine, AiEngineConfig } from '../types';
import { OpenAI } from 'openai';

export class OllamaEngine implements AiEngine {
    config: AiEngineConfig;
    client: AxiosInstance;

    constructor(config: AiEngineConfig) {
        this.config = config;
        const baseURL = config.baseURL || 'http://localhost:11434/api/chat';
        this.client = axios.create({ baseURL });
    }

    public generateCommitMessage = async (
        messages: Array<OpenAI.Chat.Completions.ChatCompletionMessageParam>
    ): Promise<string | null> => {
        try {
            const response = await this.client.post('', {
                model: this.config.model || 'mistral',
                messages: messages.map((m) => ({
                    role: m.role,
                    content: m.content
                })),
                stream: false,
                options: {
                    temperature: 0,
                    top_p: 0.1
                }
            });

            return response.data.message?.content || null;
        } catch (error) {
            throw new Error('Ollama request failed. Is Ollama running?');
        }
    };
}
