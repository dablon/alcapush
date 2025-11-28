import { OpenAI } from 'openai';
import { getConfig } from './utils/config';

const GITMOJI_SPEC = {
    '🐛': 'Fix a bug',
    '✨': 'Introduce new features',
    '📝': 'Add or update documentation',
    '🚀': 'Deploy stuff',
    '✅': 'Add, update, or pass tests',
    '♻️': 'Refactor code',
    '⬆️': 'Upgrade dependencies',
    '🔧': 'Add or update configuration files',
    '🌐': 'Internationalization and localization',
    '💡': 'Add or update comments in source code'
};

export const getMainCommitPrompt = async (
    fullGitMojiSpec: boolean = false,
    context: string = ''
): Promise<Array<OpenAI.Chat.Completions.ChatCompletionMessageParam>> => {
    const config = getConfig();
    const language = config.ACP_LANGUAGE || 'en';
    const useEmoji = config.ACP_EMOJI;
    const useDescription = config.ACP_DESCRIPTION;
    const oneLine = config.ACP_ONE_LINE_COMMIT;

    let systemPrompt = `You are an expert software developer tasked with writing clear, concise git commit messages.

Follow the Conventional Commits specification:
- Format: <type>[optional scope]: <description>
- Types: feat, fix, docs, style, refactor, test, chore, perf, ci, build, revert
- Keep the subject line under 72 characters
- Use imperative mood ("Add feature" not "Added feature")
- Be specific and descriptive
- Group related changes together logically
- Use bullet points for multiple changes, but keep them concise
- Focus on what changed and why, not implementation details`;

    if (useEmoji) {
        systemPrompt += `\n\nPrefix each commit with an appropriate GitMoji emoji:
${Object.entries(GITMOJI_SPEC)
                .map(([emoji, desc]) => `${emoji} - ${desc}`)
                .join('\n')}`;
    }

    if (useDescription && !oneLine) {
        systemPrompt += `\n\nAfter the subject line, add a blank line and then a detailed description:
- List all modified files and their key changes (be comprehensive but concise)
- Group related files together
- Use bullet points, one per file or logical group
- Focus on the purpose and impact of changes, not code details
- Keep each bullet point to 1-2 lines maximum`;
    }

    if (oneLine) {
        systemPrompt += `\n\nIMPORTANT: Generate ONLY a single-line commit message. Do not include any description or additional lines.`;
    }

    if (language !== 'en') {
        systemPrompt += `\n\nGenerate the commit message in ${language} language.`;
    }

    if (context) {
        systemPrompt += `\n\nAdditional context: ${context}`;
    }

    systemPrompt += `\n\nAnalyze the git diff and generate an appropriate commit message that covers ALL changes in ALL files. 
- Make sure to mention every modified file shown in the diff
- Group related files logically (e.g., all utils together, all commands together)
- Be concise but comprehensive - mention what each file does, not how
- Use clear, professional language
- Return ONLY the commit message, nothing else.`;

    return [
        {
            role: 'system',
            content: systemPrompt
        }
    ];
};

export const getCommitMessageFromDiff = (diff: string): string => {
    return `Here is the git diff showing changes across multiple files:\n\n${diff}\n\nGenerate a comprehensive commit message that:
1. Covers ALL changes in ALL files shown in the diff
2. Mentions every modified file
3. Groups related files together logically
4. Is concise but complete - focus on what changed, not implementation details
5. Uses clear bullet points for organization`;
};
