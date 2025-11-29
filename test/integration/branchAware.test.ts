import { TestGitRepo } from './helpers/git';
import { TestConfig } from './helpers/config';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';
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
            mockEngine.setResponse('default', 'test: commit message from AI');
            return mockEngine;
        }),
    };
});

describe('Branch-Aware Commit Integration Tests', () => {
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

    beforeEach(async () => {
        const repoPath = join(tmpdir(), `test-repo-${randomUUID()}`);
        testRepo = new TestGitRepo(repoPath);
        await testRepo.init();
        
        testConfig.clear();
        testConfig.set('ACP_API_KEY', 'sk-test123');
        testConfig.set('ACP_MODEL', 'gpt-4o-mini');
        testConfig.set('ACP_AI_PROVIDER', 'openai');
    });

    afterEach(async () => {
        await testRepo.cleanup();
    });

    describe('feature branch', () => {
        it('should include branch context in commit message generation', async () => {
            const originalCwd = process.cwd();
            process.chdir(testRepo.repoPath);

            // Create and checkout feature branch
            await testRepo.runGit(['checkout', '-b', 'feature/user-auth']);
            
            await testRepo.createFile('auth.js', 'function login() {}');
            await testRepo.stageFile('auth.js');

            const { getEngine } = require('../../src/utils/engine');
            const mockEngine = getEngine();
            mockEngine.setResponse('feat', 'feat(auth): add user authentication');

            const output = execSync(
                `node ${cliPath} --yes`,
                { encoding: 'utf-8', cwd: testRepo.repoPath }
            );

            // Verify branch context was passed to the engine
            const callHistory = mockEngine.getCallHistory();
            expect(callHistory.length).toBeGreaterThan(0);
            const systemMessage = callHistory[0].messages.find((m: any) => m.role === 'system');
            expect(systemMessage?.content).toContain('feature/user-auth');
            expect(systemMessage?.content).toContain('Branch type: feature');
            expect(systemMessage?.content).toContain('Suggested commit type: feat');
            expect(systemMessage?.content).toContain('Suggested scope: user-auth');

            process.chdir(originalCwd);
        });

        it('should save branch information to history', async () => {
            const originalCwd = process.cwd();
            process.chdir(testRepo.repoPath);

            await testRepo.runGit(['checkout', '-b', 'feature/api']);
            
            await testRepo.createFile('api.js', 'function api() {}');
            await testRepo.stageFile('api.js');

            const { getEngine } = require('../../src/utils/engine');
            const mockEngine = getEngine();
            mockEngine.setResponse('feat', 'feat: add API');

            execSync(
                `node ${cliPath} --yes`,
                { encoding: 'utf-8', cwd: testRepo.repoPath }
            );

            // Check history was saved with branch info
            const { getCommitHistory } = require('../../src/utils/storage');
            const history = getCommitHistory(1);
            expect(history.length).toBeGreaterThan(0);
            expect(history[0].branch).toBe('feature/api');

            process.chdir(originalCwd);
        });
    });

    describe('fix branch', () => {
        it('should suggest fix type for fix branch', async () => {
            const originalCwd = process.cwd();
            process.chdir(testRepo.repoPath);

            await testRepo.runGit(['checkout', '-b', 'fix/login-bug']);
            
            await testRepo.createFile('fix.js', 'function fix() {}');
            await testRepo.stageFile('fix.js');

            const { getEngine } = require('../../src/utils/engine');
            const mockEngine = getEngine();
            mockEngine.setResponse('fix', 'fix(login): resolve login bug');

            const output = execSync(
                `node ${cliPath} --yes`,
                { encoding: 'utf-8', cwd: testRepo.repoPath }
            );

            const callHistory = mockEngine.getCallHistory();
            const systemMessage = callHistory[0].messages.find((m: any) => m.role === 'system');
            expect(systemMessage?.content).toContain('fix/login-bug');
            expect(systemMessage?.content).toContain('Branch type: fix');
            expect(systemMessage?.content).toContain('Suggested commit type: fix');
            expect(systemMessage?.content).toContain('Suggested scope: login-bug');

            process.chdir(originalCwd);
        });
    });

    describe('hotfix branch', () => {
        it('should suggest fix type for hotfix branch', async () => {
            const originalCwd = process.cwd();
            process.chdir(testRepo.repoPath);

            await testRepo.runGit(['checkout', '-b', 'hotfix/security-patch']);
            
            await testRepo.createFile('security.js', 'function patch() {}');
            await testRepo.stageFile('security.js');

            const { getEngine } = require('../../src/utils/engine');
            const mockEngine = getEngine();
            mockEngine.setResponse('fix', 'fix(security): apply security patch');

            execSync(
                `node ${cliPath} --yes`,
                { encoding: 'utf-8', cwd: testRepo.repoPath }
            );

            const callHistory = mockEngine.getCallHistory();
            const systemMessage = callHistory[0].messages.find((m: any) => m.role === 'system');
            expect(systemMessage?.content).toContain('hotfix/security-patch');
            expect(systemMessage?.content).toContain('Branch type: hotfix');
            expect(systemMessage?.content).toContain('Suggested commit type: fix');

            process.chdir(originalCwd);
        });
    });

    describe('docs branch', () => {
        it('should suggest docs type for docs branch', async () => {
            const originalCwd = process.cwd();
            process.chdir(testRepo.repoPath);

            await testRepo.runGit(['checkout', '-b', 'docs/readme']);
            
            await testRepo.createFile('README.md', '# Documentation');
            await testRepo.stageFile('README.md');

            const { getEngine } = require('../../src/utils/engine');
            const mockEngine = getEngine();
            mockEngine.setResponse('docs', 'docs: update README');

            execSync(
                `node ${cliPath} --yes`,
                { encoding: 'utf-8', cwd: testRepo.repoPath }
            );

            const callHistory = mockEngine.getCallHistory();
            const systemMessage = callHistory[0].messages.find((m: any) => m.role === 'system');
            expect(systemMessage?.content).toContain('docs/readme');
            expect(systemMessage?.content).toContain('Branch type: docs');
            expect(systemMessage?.content).toContain('Suggested commit type: docs');

            process.chdir(originalCwd);
        });
    });

    describe('chore branch', () => {
        it('should suggest chore type for chore branch', async () => {
            const originalCwd = process.cwd();
            process.chdir(testRepo.repoPath);

            await testRepo.runGit(['checkout', '-b', 'chore/dependencies']);
            
            await testRepo.createFile('package.json', '{}');
            await testRepo.stageFile('package.json');

            const { getEngine } = require('../../src/utils/engine');
            const mockEngine = getEngine();
            mockEngine.setResponse('chore', 'chore: update dependencies');

            execSync(
                `node ${cliPath} --yes`,
                { encoding: 'utf-8', cwd: testRepo.repoPath }
            );

            const callHistory = mockEngine.getCallHistory();
            const systemMessage = callHistory[0].messages.find((m: any) => m.role === 'system');
            expect(systemMessage?.content).toContain('chore/dependencies');
            expect(systemMessage?.content).toContain('Branch type: chore');
            expect(systemMessage?.content).toContain('Suggested commit type: chore');

            process.chdir(originalCwd);
        });
    });

    describe('main/master branch', () => {
        it('should handle main branch without branch-specific context', async () => {
            const originalCwd = process.cwd();
            process.chdir(testRepo.repoPath);

            // Already on main branch
            await testRepo.createFile('main.js', 'function main() {}');
            await testRepo.stageFile('main.js');

            const { getEngine } = require('../../src/utils/engine');
            const mockEngine = getEngine();
            mockEngine.setResponse('default', 'chore: update main');

            execSync(
                `node ${cliPath} --yes`,
                { encoding: 'utf-8', cwd: testRepo.repoPath }
            );

            const callHistory = mockEngine.getCallHistory();
            const systemMessage = callHistory[0].messages.find((m: any) => m.role === 'system');
            // Should still include branch name
            expect(systemMessage?.content).toContain('main');
            // But no suggested type for 'other' branch type
            expect(systemMessage?.content).toContain('Branch type: other');

            process.chdir(originalCwd);
        });
    });

    describe('branch with scope extraction', () => {
        it('should extract scope from feature branch name', async () => {
            const originalCwd = process.cwd();
            process.chdir(testRepo.repoPath);

            await testRepo.runGit(['checkout', '-b', 'feature/api/user-auth']);
            
            await testRepo.createFile('auth.js', 'function auth() {}');
            await testRepo.stageFile('auth.js');

            const { getEngine } = require('../../src/utils/engine');
            const mockEngine = getEngine();
            mockEngine.setResponse('feat', 'feat: add auth');

            execSync(
                `node ${cliPath} --yes`,
                { encoding: 'utf-8', cwd: testRepo.repoPath }
            );

            const callHistory = mockEngine.getCallHistory();
            const systemMessage = callHistory[0].messages.find((m: any) => m.role === 'system');
            expect(systemMessage?.content).toContain('Suggested scope: api/user-auth');

            process.chdir(originalCwd);
        });

        it('should clean up ticket numbers from scope', async () => {
            const originalCwd = process.cwd();
            process.chdir(testRepo.repoPath);

            await testRepo.runGit(['checkout', '-b', 'feature/JIRA-123-user-auth']);
            
            await testRepo.createFile('auth.js', 'function auth() {}');
            await testRepo.stageFile('auth.js');

            const { getEngine } = require('../../src/utils/engine');
            const mockEngine = getEngine();
            mockEngine.setResponse('feat', 'feat: add auth');

            execSync(
                `node ${cliPath} --yes`,
                { encoding: 'utf-8', cwd: testRepo.repoPath }
            );

            const callHistory = mockEngine.getCallHistory();
            const systemMessage = callHistory[0].messages.find((m: any) => m.role === 'system');
            // Should clean up ticket number (JIRA-123- gets removed)
            expect(systemMessage?.content).toContain('Suggested scope: user-auth');

            process.chdir(originalCwd);
        });
    });
});

