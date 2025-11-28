import { TestConfig } from './helpers/config';
import { execSync } from 'child_process';
import { join } from 'path';

describe('Config Command Integration Tests', () => {
  let testConfig: TestConfig;
  const cliPath = join(__dirname, '../../out/cli.cjs');

  beforeAll(() => {
    testConfig = new TestConfig();
    testConfig.backup();
  });

  afterAll(() => {
    testConfig.restore();
  });

  beforeEach(() => {
    testConfig.clear();
  });

  describe('config set', () => {
    it('should set a configuration value', () => {
      const output = execSync(
        `node ${cliPath} config set ACP_MODEL=gpt-4o-mini`,
        { encoding: 'utf-8' }
      );
      
      expect(output).toContain('Set ACP_MODEL=gpt-4o-mini');
      expect(testConfig.get('ACP_MODEL')).toBe('gpt-4o-mini');
    });

    it('should set multiple configuration values', () => {
      execSync(
        `node ${cliPath} config set ACP_MODEL=gpt-4o-mini ACP_EMOJI=true`,
        { encoding: 'utf-8' }
      );

      expect(testConfig.get('ACP_MODEL')).toBe('gpt-4o-mini');
      expect(testConfig.get('ACP_EMOJI')).toBe('true');
    });

    it('should handle boolean values correctly', () => {
      execSync(`node ${cliPath} config set ACP_EMOJI=true`, { encoding: 'utf-8' });
      expect(testConfig.get('ACP_EMOJI')).toBe('true');

      execSync(`node ${cliPath} config set ACP_EMOJI=false`, { encoding: 'utf-8' });
      expect(testConfig.get('ACP_EMOJI')).toBe('false');
    });

    it('should handle numeric values correctly', () => {
      execSync(`node ${cliPath} config set ACP_TOKENS_MAX_INPUT=8192`, { encoding: 'utf-8' });
      const value = testConfig.get('ACP_TOKENS_MAX_INPUT');
      expect(value).toBe('8192');
    });
  });

  describe('config get', () => {
    it('should get a configuration value', () => {
      testConfig.set('ACP_MODEL', 'gpt-4o-mini');
      
      const output = execSync(
        `node ${cliPath} config get ACP_MODEL`,
        { encoding: 'utf-8' }
      );

      expect(output).toContain('ACP_MODEL=gpt-4o-mini');
    });

    it('should return undefined for non-existent key', () => {
      const output = execSync(
        `node ${cliPath} config get ACP_NONEXISTENT`,
        { encoding: 'utf-8' }
      );

      expect(output).toContain('is not set');
    });
  });

  describe('config list', () => {
    it('should list all configuration values', () => {
      testConfig.set('ACP_MODEL', 'gpt-4o-mini');
      testConfig.set('ACP_EMOJI', 'true');
      testConfig.set('ACP_API_KEY', 'sk-test1234567890');

      const output = execSync(`node ${cliPath} config list`, { encoding: 'utf-8' });

      expect(output).toContain('Current configuration');
      expect(output).toContain('ACP_MODEL');
      expect(output).toContain('gpt-4o-mini');
      expect(output).toContain('ACP_EMOJI');
      expect(output).toContain('true');
      // API key should be masked
      expect(output).toContain('***');
      expect(output).not.toContain('sk-test1234567890');
    });
  });

  describe('config describe', () => {
    it('should describe a specific configuration key', () => {
      const output = execSync(
        `node ${cliPath} config describe ACP_MODEL`,
        { encoding: 'utf-8' }
      );

      expect(output).toContain('ACP_MODEL');
      expect(output).toContain('Model name');
    });

    it('should list all descriptions when no key provided', () => {
      const output = execSync(
        `node ${cliPath} config describe`,
        { encoding: 'utf-8' }
      );

      expect(output).toContain('Available configuration options');
      expect(output).toContain('ACP_API_KEY');
      expect(output).toContain('ACP_MODEL');
    });
  });

  describe('config test', () => {
    it('should fail when API key is not configured', () => {
      const output = execSync(
        `node ${cliPath} config test`,
        { encoding: 'utf-8' }
      );

      expect(output).toContain('API key not configured');
    });

    it('should fail when model is not configured', () => {
      testConfig.set('ACP_API_KEY', 'sk-test123');
      
      const output = execSync(
        `node ${cliPath} config test`,
        { encoding: 'utf-8' }
      );

      expect(output).toContain('Model not configured');
    });

    // Note: Full connectivity test would require actual API key
    // This is tested in manual/e2e scenarios
  });
});

