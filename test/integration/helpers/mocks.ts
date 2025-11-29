import { AiEngine } from '../../src/types';
import { OpenAI } from 'openai';

export class MockAiEngine implements AiEngine {
  config: any;
  private responses: Map<string, string> = new Map();
  private callHistory: Array<{ messages: any[] }> = [];

  constructor(config: any) {
    this.config = config;
  }

  setResponse(key: string, response: string): void {
    this.responses.set(key, response);
  }

  getCallHistory(): Array<{ messages: any[] }> {
    return this.callHistory;
  }

  async generateCommitMessage(
    messages: Array<OpenAI.Chat.Completions.ChatCompletionMessageParam>
  ): Promise<string | null | undefined> {
    this.callHistory.push({ messages: [...messages] });

    // Check if there's a specific response for this diff
    const userMessage = messages.find((m) => m.role === 'user');
    if (userMessage && typeof userMessage.content === 'string') {
      const content = userMessage.content.toLowerCase();
      
      // Return specific responses based on content
      if (content.includes('fix') || content.includes('bug')) {
        return this.responses.get('fix') || 'fix: resolve bug in test file';
      }
      if (content.includes('feat') || content.includes('feature')) {
        return this.responses.get('feat') || 'feat: add new feature';
      }
      if (content.includes('docs')) {
        return this.responses.get('docs') || 'docs: update documentation';
      }
    }

    // Default response
    return this.responses.get('default') || 'test: commit message';
  }
}

// Mock factory for engines
export function createMockEngine(config: any): MockAiEngine {
  return new MockAiEngine(config);
}


