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
- Be specific and descriptive`;

    if (useEmoji) {
        systemPrompt += `\n\nPrefix each commit with an appropriate GitMoji emoji:
${Object.entries(GITMOJI_SPEC)
                .map(([emoji, desc]) => `${emoji} - ${desc}`)
                .join('\n')}`;
    }

    if (useDescription && !oneLine) {
        systemPrompt += `\n\nAfter the subject line, add a blank line and then a detailed description (2-3 sentences) explaining:
- What changed
- Why the change was made
- Any important context or implications`;
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

    systemPrompt += `\n\nAnalyze the git diff and generate an appropriate commit message. Return ONLY the commit message, nothing else.`;

    return [
        {
            role: 'system',
            content: systemPrompt
        }
    ];
};

export const getCommitMessageFromDiff = (diff: string): string => {
    return `Here is the git diff:\n\n${diff}\n\nGenerate a commit message for these changes.`;
};
