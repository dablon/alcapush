import { existsSync, readFileSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import ini from 'ini';

const CONFIG_FILE_PATH = join(homedir(), '.alcapush');

export class TestConfig {
  private originalConfig: string | null = null;
  private originalEnv: Record<string, string | undefined> = {};

  backup(): void {
    // Backup original config file
    if (existsSync(CONFIG_FILE_PATH)) {
      this.originalConfig = readFileSync(CONFIG_FILE_PATH, 'utf-8');
    }

    // Backup environment variables
    const envKeys = [
      'ACP_API_KEY',
      'ACP_AI_PROVIDER',
      'ACP_MODEL',
      'ACP_TOKENS_MAX_INPUT',
      'ACP_TOKENS_MAX_OUTPUT',
      'ACP_EMOJI',
      'ACP_LANGUAGE',
      'ACP_DESCRIPTION',
      'ACP_API_URL',
      'ACP_API_CUSTOM_HEADERS',
      'ACP_ONE_LINE_COMMIT',
      'ACP_MESSAGE_TEMPLATE_PLACEHOLDER',
    ];

    envKeys.forEach((key) => {
      this.originalEnv[key] = process.env[key];
    });
  }

  restore(): void {
    // Restore config file
    if (this.originalConfig !== null) {
      writeFileSync(CONFIG_FILE_PATH, this.originalConfig);
    } else if (existsSync(CONFIG_FILE_PATH)) {
      rmSync(CONFIG_FILE_PATH);
    }

    // Restore environment variables
    Object.entries(this.originalEnv).forEach(([key, value]) => {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    });
  }

  set(key: string, value: string): void {
    const config = existsSync(CONFIG_FILE_PATH)
      ? ini.parse(readFileSync(CONFIG_FILE_PATH, 'utf-8'))
      : {};

    let parsedValue: any = value;
    if (value === 'true' || value === 'false') {
      parsedValue = value === 'true';
    } else if (!isNaN(Number(value))) {
      parsedValue = Number(value);
    }

    config[key] = parsedValue;
    writeFileSync(CONFIG_FILE_PATH, ini.stringify(config));
  }

  get(key: string): string | undefined {
    if (!existsSync(CONFIG_FILE_PATH)) {
      return undefined;
    }
    const config = ini.parse(readFileSync(CONFIG_FILE_PATH, 'utf-8'));
    return config[key]?.toString();
  }

  clear(): void {
    if (existsSync(CONFIG_FILE_PATH)) {
      rmSync(CONFIG_FILE_PATH);
    }
  }
}


