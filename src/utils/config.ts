import { homedir } from 'os';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import ini from 'ini';
import {
    alcapushConfig,
    DEFAULT_CONFIG,
    AIProvider,
    DEFAULT_TOKEN_LIMITS
} from '../types';

const CONFIG_FILE_PATH = join(homedir(), '.alcapush');

export const getConfig = (): Required<alcapushConfig> => {
    const config = { ...DEFAULT_CONFIG } as alcapushConfig;

    // Read from config file if exists
    if (existsSync(CONFIG_FILE_PATH)) {
        try {
            const fileConfig = ini.parse(readFileSync(CONFIG_FILE_PATH, 'utf-8'));
            Object.assign(config, fileConfig);
        } catch (error) {
            console.warn('Failed to read config file, using defaults');
        }
    }

    // Override with environment variables
    if (process.env.ACP_API_KEY) config.ACP_API_KEY = process.env.ACP_API_KEY;
    if (process.env.ACP_AI_PROVIDER)
        config.ACP_AI_PROVIDER = process.env.ACP_AI_PROVIDER as AIProvider;
    if (process.env.ACP_MODEL) config.ACP_MODEL = process.env.ACP_MODEL;
    if (process.env.ACP_TOKENS_MAX_INPUT)
        config.ACP_TOKENS_MAX_INPUT = parseInt(
            process.env.ACP_TOKENS_MAX_INPUT,
            10
        );
    if (process.env.ACP_TOKENS_MAX_OUTPUT)
        config.ACP_TOKENS_MAX_OUTPUT = parseInt(
            process.env.ACP_TOKENS_MAX_OUTPUT,
            10
        );
    if (process.env.ACP_EMOJI)
        config.ACP_EMOJI = process.env.ACP_EMOJI === 'true';
    if (process.env.ACP_LANGUAGE) config.ACP_LANGUAGE = process.env.ACP_LANGUAGE;
    if (process.env.ACP_DESCRIPTION)
        config.ACP_DESCRIPTION = process.env.ACP_DESCRIPTION === 'true';
    if (process.env.ACP_API_URL) config.ACP_API_URL = process.env.ACP_API_URL;
    if (process.env.ACP_API_CUSTOM_HEADERS)
        config.ACP_API_CUSTOM_HEADERS = process.env.ACP_API_CUSTOM_HEADERS;
    if (process.env.ACP_ONE_LINE_COMMIT)
        config.ACP_ONE_LINE_COMMIT = process.env.ACP_ONE_LINE_COMMIT === 'true';
    if (process.env.ACP_MESSAGE_TEMPLATE_PLACEHOLDER)
        config.ACP_MESSAGE_TEMPLATE_PLACEHOLDER =
            process.env.ACP_MESSAGE_TEMPLATE_PLACEHOLDER;

    // Read from local .env file if exists
    const localEnvPath = join(process.cwd(), '.env');
    if (existsSync(localEnvPath)) {
        try {
            const envContent = readFileSync(localEnvPath, 'utf-8');
            const envLines = envContent.split('\n');
            envLines.forEach((line) => {
                const [key, ...valueParts] = line.split('=');
                const value = valueParts.join('=').trim();
                if (key && value && key.startsWith('ACP_')) {
                    const configKey = key.trim() as keyof alcapushConfig;
                    if (configKey === 'ACP_EMOJI' || configKey === 'ACP_DESCRIPTION' || configKey === 'ACP_ONE_LINE_COMMIT') {
                        (config as any)[configKey] = value === 'true';
                    } else if (configKey === 'ACP_TOKENS_MAX_INPUT' || configKey === 'ACP_TOKENS_MAX_OUTPUT') {
                        (config as any)[configKey] = parseInt(value, 10);
                    } else {
                        (config as any)[configKey] = value;
                    }
                }
            });
        } catch (error) {
            // Ignore local env errors
        }
    }

    return config as Required<alcapushConfig>;
};

export const setConfig = (key: string, value: string): void => {
    const config = existsSync(CONFIG_FILE_PATH)
        ? ini.parse(readFileSync(CONFIG_FILE_PATH, 'utf-8'))
        : {};

    // Parse boolean and number values
    let parsedValue: any = value;
    if (value === 'true' || value === 'false') {
        parsedValue = value === 'true';
    } else if (!isNaN(Number(value))) {
        parsedValue = Number(value);
    }

    config[key] = parsedValue;
    writeFileSync(CONFIG_FILE_PATH, ini.stringify(config));
};

export const getConfigValue = (key: string): string | undefined => {
    const config = getConfig();
    return (config as any)[key]?.toString();
};

export const describeConfig = (key?: string): void => {
    const descriptions: Record<string, string> = {
        ACP_API_KEY: 'API key for the AI provider',
        ACP_AI_PROVIDER: `AI provider to use (${Object.values(AIProvider).join(', ')})`,
        ACP_MODEL: 'Model name (default: gpt-5-nano, fallback: gpt-4o-mini)',
        ACP_TOKENS_MAX_INPUT: `Max input tokens (default: ${DEFAULT_TOKEN_LIMITS.DEFAULT_MAX_TOKENS_INPUT})`,
        ACP_TOKENS_MAX_OUTPUT: `Max output tokens (default: ${DEFAULT_TOKEN_LIMITS.DEFAULT_MAX_TOKENS_OUTPUT})`,
        ACP_EMOJI: 'Enable GitMoji emojis (true/false)',
        ACP_LANGUAGE: 'Language for commit messages (default: en)',
        ACP_DESCRIPTION: 'Add detailed description to commits (true/false)',
        ACP_API_URL: 'Custom API URL for the provider',
        ACP_API_CUSTOM_HEADERS: 'Custom HTTP headers (JSON string)',
        ACP_ONE_LINE_COMMIT: 'Generate one-line commit messages (true/false)',
        ACP_MESSAGE_TEMPLATE_PLACEHOLDER: 'Template placeholder (default: $msg)'
    };

    if (key) {
        console.log(`${key}: ${descriptions[key] || 'Unknown configuration key'}`);
    } else {
        console.log('Available configuration options:\n');
        Object.entries(descriptions).forEach(([k, desc]) => {
            console.log(`  ${k}:`);
            console.log(`    ${desc}\n`);
        });
    }
};
