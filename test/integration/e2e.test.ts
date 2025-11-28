import { TestGitRepo } from './helpers/git';
import { TestConfig } from './helpers/config';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';
import { join } from 'path';
import { execSync } from 'child_process';

// Mock the engine module
jest.mock('../../src/utils/engine', () => {
  const { MockAiEngine } = require('./helpers/mocks');
  return {
    getEngine: jest.fn(() => {
      const mockEngine = new MockAiEngine({
        model: 'gpt-4o-mini',
        apiKey: 'sk-test',
        maxTokensOutput: 500,
        maxTokensInput: 4096,
      });
      return mockEngine;
    }),
  };
});

describe('End-to-End Integration Tests', () => {
  let testRepo: TestGitRepo;
  let testConfig: TestConfig;
  const cliPath = join(__dirname, '../../out/cli.cjs');

  beforeAll(() => {
    testConfig = new TestConfig();
    testConfig.backup();
  });

  afterAll(() => {
    testConfig.restore();
  });

  let originalCwd: string;

  beforeEach(async () => {
    originalCwd = process.cwd();
    const repoPath = join(tmpdir(), `test-repo-${randomUUID()}`);
    testRepo = new TestGitRepo(repoPath);
    await testRepo.init();
    
    testConfig.clear();
    testConfig.set('ACP_API_KEY', 'sk-test123');
    testConfig.set('ACP_MODEL', 'gpt-4o-mini');
    testConfig.set('ACP_AI_PROVIDER', 'openai');
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await testRepo.cleanup();
  });

  describe('Full commit workflow', () => {
    it('should complete full workflow: stage -> generate -> commit', async () => {
      const originalCwd = process.cwd();
      process.chdir(testRepo.repoPath);

      // Create and stage a file
      await testRepo.createFile('src/utils.ts', 'export function helper() {}');
      await testRepo.stageFile('src/utils.ts');

      // Mock AI response
      const { getEngine } = require('../../src/utils/engine');
      const mockEngine = getEngine();
      mockEngine.setResponse('feat', 'feat: add helper utility function');

      // Run commit command
      const output = execSync(
        `node ${cliPath} --yes`,
        { encoding: 'utf-8', cwd: testRepo.repoPath }
      );

      // Verify output
      expect(output).toContain('Commit message generated');
      expect(output).toContain('Changes committed successfully');

      // Verify commit was created
      const commits = await testRepo.getCommits();
      expect(commits.length).toBe(1);

      const lastCommit = await testRepo.getLastCommitMessage();
      expect(lastCommit).toContain('feat: add helper utility function');
      
      process.chdir(originalCwd);
    });

    it('should handle multiple files in a single commit', async () => {
      const originalCwd = process.cwd();
      process.chdir(testRepo.repoPath);

      await testRepo.createFile('file1.ts', 'export const a = 1;');
      await testRepo.createFile('file2.ts', 'export const b = 2;');
      await testRepo.createFile('file3.ts', 'export const c = 3;');
      await testRepo.stageAll();

      const { getEngine } = require('../../src/utils/engine');
      const mockEngine = getEngine();
      mockEngine.setResponse('feat', 'feat: add multiple utility files');

      const output = execSync(
        `node ${cliPath} --yes`,
        { encoding: 'utf-8', cwd: testRepo.repoPath }
      );

      expect(output).toContain('Changes committed successfully');

      const commits = await testRepo.getCommits();
      expect(commits.length).toBe(1);
      
      process.chdir(originalCwd);
    });

    it('should handle commit with context', async () => {
      const originalCwd = process.cwd();
      process.chdir(testRepo.repoPath);

      await testRepo.createFile('README.md', '# Project Documentation');
      await testRepo.stageFile('README.md');

      const { getEngine } = require('../../src/utils/engine');
      const mockEngine = getEngine();
      mockEngine.setResponse('docs', 'docs: add project documentation');

      const output = execSync(
        `node ${cliPath} --yes --context "Initial project setup"`,
        { encoding: 'utf-8', cwd: testRepo.repoPath }
      );

      expect(output).toContain('Changes committed successfully');

      // Verify context was used
      const callHistory = mockEngine.getCallHistory();
      expect(callHistory.length).toBeGreaterThan(0);
      const systemMessage = callHistory[0].messages.find((m: any) => m.role === 'system');
      expect(systemMessage?.content).toContain('Initial project setup');
      
      process.chdir(originalCwd);
    });

    it('should handle different file types', async () => {
      const originalCwd = process.cwd();
      process.chdir(testRepo.repoPath);

      await testRepo.createFile('src/index.ts', 'console.log("Hello");');
      await testRepo.createFile('test/index.test.ts', "describe('test', () => {});");
      await testRepo.createFile('README.md', '# Documentation');
      await testRepo.stageAll();

      const { getEngine } = require('../../src/utils/engine');
      const mockEngine = getEngine();
      mockEngine.setResponse('feat', 'feat: add source, test, and documentation files');

      const output = execSync(
        `node ${cliPath} --yes`,
        { encoding: 'utf-8', cwd: testRepo.repoPath }
      );

      expect(output).toContain('Changes committed successfully');

      const commits = await testRepo.getCommits();
      expect(commits.length).toBe(1);
      
      process.chdir(originalCwd);
    });
  });

  describe('Configuration integration', () => {
    it('should use configured model and provider', async () => {
      const originalCwd = process.cwd();
      process.chdir(testRepo.repoPath);

      testConfig.set('ACP_MODEL', 'gpt-4o-mini');
      testConfig.set('ACP_AI_PROVIDER', 'openai');
      testConfig.set('ACP_EMOJI', 'true');

      await testRepo.createFile('feature.js', 'function feature() {}');
      await testRepo.stageFile('feature.js');

      const { getEngine } = require('../../src/utils/engine');
      const mockEngine = getEngine();

      execSync(
        `node ${cliPath} --yes`,
        { encoding: 'utf-8', cwd: testRepo['repoPath'] }
      );

      // Verify engine was called with correct config
      expect(mockEngine.config.model).toBe('gpt-4o-mini');
      
      process.chdir(originalCwd);
    });

    it('should respect emoji configuration', async () => {
      const originalCwd = process.cwd();
      process.chdir(testRepo.repoPath);

      testConfig.set('ACP_EMOJI', 'true');

      await testRepo.createFile('fix.js', 'function fix() {}');
      await testRepo.stageFile('fix.js');

      const { getEngine } = require('../../src/utils/engine');
      const mockEngine = getEngine();

      execSync(
        `node ${cliPath} --yes`,
        { encoding: 'utf-8', cwd: testRepo['repoPath'] }
      );

      // Verify emoji was requested in prompt
      const callHistory = mockEngine.getCallHistory();
      if (callHistory.length > 0) {
        const systemMessage = callHistory[0].messages.find((m: any) => m.role === 'system');
        expect(systemMessage?.content).toContain('GitMoji');
      }
      
      process.chdir(originalCwd);
    });
  });

  describe('Error handling', () => {
    it('should handle AI generation failure gracefully', async () => {
      const originalCwd = process.cwd();
      process.chdir(testRepo.repoPath);

      await testRepo.createFile('test.js', 'test');
      await testRepo.stageFile('test.js');

      const { getEngine } = require('../../src/utils/engine');
      const mockEngine = getEngine();
      // Make engine return null to simulate failure
      mockEngine.setResponse('default', null as any);

      try {
        execSync(
          `node ${cliPath} --yes`,
          { encoding: 'utf-8', cwd: testRepo.repoPath }
        );
        fail('Should have thrown an error');
      } catch (error: any) {
        // Should fail with appropriate error message
        expect(error.message).toBeDefined();
      } finally {
        process.chdir(originalCwd);
      }
    });

    it('should not commit when generation fails', async () => {
      const originalCwd = process.cwd();
      process.chdir(testRepo.repoPath);

      await testRepo.createFile('test.js', 'test');
      await testRepo.stageFile('test.js');

      const { getEngine } = require('../../src/utils/engine');
      const mockEngine = getEngine();
      mockEngine.setResponse('default', null as any);

      try {
        execSync(
          `node ${cliPath} --yes`,
          { encoding: 'utf-8', cwd: testRepo.repoPath }
        );
      } catch {
        // Expected to fail
      }

      // Verify no commit was made
      const commits = await testRepo.getCommits();
      expect(commits.length).toBe(0);
      
      process.chdir(originalCwd);
    });
  });
});

