import { GoogleGenerativeAI } from '@google/generative-ai';
import { AiEngine, AiEngineConfig } from '../types';
import { OpenAI } from 'openai';

export class GeminiEngine implements AiEngine {
    config: AiEngineConfig;
    client: GoogleGenerativeAI;

    constructor(config: AiEngineConfig) {
        this.config = config;
        this.client = new GoogleGenerativeAI(config.apiKey);
    }

    public generateCommitMessage = async (
        messages: Array<OpenAI.Chat.Completions.ChatCompletionMessageParam>
    ): Promise<string | null> => {
        try {
            const model = this.client.getGenerativeModel({
                model: this.config.model || 'gemini-pro'
            });

            // Combine all messages into a single prompt
            const prompt = messages
                .map((m) => `${m.role}: ${m.content}`)
                .join('\n\n');

            const result = await model.generateContent(prompt);
            const response = result.response;
            return response.text();
        } catch (error) {
            throw error;
        }
    };
}
