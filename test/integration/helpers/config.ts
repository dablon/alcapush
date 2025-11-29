import { existsSync, readFileSync, writeFileSync, rmSync, mkdirSync, statSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import ini from 'ini';

const CONFIG_DIR = join(homedir(), '.alcapush');
const CONFIG_FILE_PATH = join(CONFIG_DIR, 'config.ini');

// Check if path exists and is a file
const isFile = (path: string): boolean => {
  try {
    return existsSync(path) && statSync(path).isFile();
  } catch {
    return false;
  }
};

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
          rmSync(CONFIG_DIR); // Remove old file
          mkdirSync(CONFIG_DIR, { recursive: true });
          writeFileSync(CONFIG_FILE_PATH, oldConfig);
        } catch (error) {
          // If migration fails, try to clean up and create directory
          try {
            if (existsSync(CONFIG_DIR)) {
              rmSync(CONFIG_DIR);
            }
            mkdirSync(CONFIG_DIR, { recursive: true });
          } catch {
            // Ignore errors during cleanup
          }
        }
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

export class TestConfig {
  private originalConfig: string | null = null;
  private originalEnv: Record<string, string | undefined> = {};

  backup(): void {
    // Ensure config directory exists (and migrate old config if needed)
    ensureConfigDir();
    
    // Backup original config file
    if (isFile(CONFIG_FILE_PATH)) {
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
    // Ensure config directory exists
    ensureConfigDir();
    
    // Restore config file
    if (this.originalConfig !== null) {
      writeFileSync(CONFIG_FILE_PATH, this.originalConfig);
    } else if (isFile(CONFIG_FILE_PATH)) {
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
    // Ensure config directory exists
    ensureConfigDir();
    
    const config = isFile(CONFIG_FILE_PATH)
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
    // Ensure config directory exists
    ensureConfigDir();
    
    if (!isFile(CONFIG_FILE_PATH)) {
      return undefined;
    }
    const config = ini.parse(readFileSync(CONFIG_FILE_PATH, 'utf-8'));
    return config[key]?.toString();
  }

  clear(): void {
    // Ensure config directory exists
    ensureConfigDir();
    
    if (isFile(CONFIG_FILE_PATH)) {
      rmSync(CONFIG_FILE_PATH);
    }
  }
}


