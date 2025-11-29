import { homedir } from 'os';
import { existsSync, readFileSync, writeFileSync, statSync, mkdirSync, unlinkSync } from 'fs';
import { join } from 'path';
import ini from 'ini';
import {
    alcapushConfig,
    DEFAULT_CONFIG,
    AIProvider,
    DEFAULT_TOKEN_LIMITS
} from '../types';

const CONFIG_DIR = join(homedir(), '.alcapush');
const CONFIG_FILE_PATH = join(CONFIG_DIR, 'config.ini');

// Ensure config directory exists
const ensureConfigDir = (): void => {
    if (!existsSync(CONFIG_DIR)) {
        mkdirSync(CONFIG_DIR, { recursive: true });
    } else {
        // Check if .alcapush exists as a file (old format) and migrate it
        try {
            const stat = statSync(CONFIG_DIR);
            if (stat.isFile()) {
                // Migrate old config file to new location
                try {
                    const oldConfig = readFileSync(CONFIG_DIR, 'utf-8');
                    // Create directory first (will fail if file exists, so remove it)
                    unlinkSync(CONFIG_DIR); // Remove old file
                    mkdirSync(CONFIG_DIR, { recursive: true });
                    writeFileSync(CONFIG_FILE_PATH, oldConfig);
                } catch (error) {
                    // If migration fails, try to clean up and create directory
                    try {
                        if (existsSync(CONFIG_DIR)) {
                            unlinkSync(CONFIG_DIR);
                        }
                        mkdirSync(CONFIG_DIR, { recursive: true });
                    } catch {
                        // Ignore errors during cleanup
                    }
                }
            } else if (stat.isDirectory()) {
                // Already a directory, which is correct - ensure config file can be created
                // (directory already exists, so nothing to do)
            }
        } catch (error) {
            // If stat fails, assume it doesn't exist and create directory
            try {
                mkdirSync(CONFIG_DIR, { recursive: true });
            } catch {
                // Ignore errors
            }
        }
    }
};

// Check if path exists and is a file
const isFile = (path: string): boolean => {
    try {
        return existsSync(path) && statSync(path).isFile();
    } catch {
        return false;
    }
};

export const getConfig = (): Required<alcapushConfig> => {
    const config = { ...DEFAULT_CONFIG } as alcapushConfig;

    // Ensure config directory exists (and migrate old config if needed)
    ensureConfigDir();

    // Read from config file if exists
    if (isFile(CONFIG_FILE_PATH)) {
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
    // Note: .env file values should NOT override config file values for security
    // Only use .env if config file doesn't have the value
    const localEnvPath = join(process.cwd(), '.env');
    if (existsSync(localEnvPath)) {
        try {
            const envContent = readFileSync(localEnvPath, 'utf-8');
            const envLines = envContent.split('\n');
            envLines.forEach((line) => {
                // Skip comments and empty lines
                const trimmedLine = line.trim();
                if (!trimmedLine || trimmedLine.startsWith('#')) {
                    return;
                }
                
                const [key, ...valueParts] = trimmedLine.split('=');
                const value = valueParts.join('=').trim();
                
                // Remove quotes if present
                const unquotedValue = value.replace(/^["']|["']$/g, '');
                
                if (key && unquotedValue && key.trim().startsWith('ACP_')) {
                    const configKey = key.trim() as keyof alcapushConfig;
                    
                    // For API key, only use .env value if config file doesn't have it
                    // This prevents .env from overriding the user's configured API key
                    if (configKey === 'ACP_API_KEY' && config.ACP_API_KEY) {
                        return; // Skip - config file value takes precedence
                    }
                    
                    if (configKey === 'ACP_EMOJI' || configKey === 'ACP_DESCRIPTION' || configKey === 'ACP_ONE_LINE_COMMIT') {
                        // Only override if not already set in config file
                        if (config[configKey] === undefined) {
                            (config as any)[configKey] = unquotedValue === 'true';
                        }
                    } else if (configKey === 'ACP_TOKENS_MAX_INPUT' || configKey === 'ACP_TOKENS_MAX_OUTPUT') {
                        // Only override if not already set in config file
                        if (config[configKey] === undefined) {
                            (config as any)[configKey] = parseInt(unquotedValue, 10);
                        }
                    } else {
                        // Only override if not already set in config file
                        if (config[configKey] === undefined) {
                            (config as any)[configKey] = unquotedValue;
                        }
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
    // Ensure config directory exists (and migrate old config if needed)
    ensureConfigDir();

    const config = isFile(CONFIG_FILE_PATH)
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
