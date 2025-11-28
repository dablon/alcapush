import Anthropic from '@anthropic-ai/sdk';
import { AiEngine, AiEngineConfig } from '../types';
import { OpenAI } from 'openai';

export class AnthropicEngine implements AiEngine {
    config: AiEngineConfig;
    client: Anthropic;

    constructor(config: AiEngineConfig) {
        this.config = config;
        this.client = new Anthropic({
            apiKey: config.apiKey
        });
    }

    public generateCommitMessage = async (
        messages: Array<OpenAI.Chat.Completions.ChatCompletionMessageParam>
    ): Promise<string | null> => {
        try {
            // Convert OpenAI format to Anthropic format
            const systemMessage = messages.find((m) => m.role === 'system');
            const userMessages = messages.filter((m) => m.role !== 'system');

            const response = await this.client.messages.create({
                model: this.config.model || 'claude-3-5-sonnet-20241022',
                max_tokens: this.config.maxTokensOutput,
                system: systemMessage?.content as string,
                messages: userMessages.map((m) => ({
                    role: m.role as 'user' | 'assistant',
                    content: m.content as string
                }))
            });

            const content = response.content[0];
            return content.type === 'text' ? content.text : null;
        } catch (error) {
            throw error;
        }
    };
}
