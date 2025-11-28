import { TestGitRepo } from './helpers/git';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';
import { join } from 'path';
import {
  getStagedDiff,
  stageAllChanges,
  commit as gitCommit,
  isGitRepository,
  hasChanges,
  getCurrentBranch,
} from '../../src/utils/git';

describe('Git Utils Integration Tests', () => {
  let testRepo: TestGitRepo;

  let originalCwd: string;

  beforeEach(async () => {
    originalCwd = process.cwd();
    const repoPath = join(tmpdir(), `test-repo-${randomUUID()}`);
    testRepo = new TestGitRepo(repoPath);
    await testRepo.init();
    process.chdir(testRepo['repoPath']);
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await testRepo.cleanup();
  });

  describe('isGitRepository', () => {
    it('should return true for a git repository', async () => {
      const result = await isGitRepository();
      expect(result).toBe(true);
    });

    it('should return false for a non-git directory', async () => {
      const nonGitDir = join(tmpdir(), `non-git-${randomUUID()}`);
      require('fs').mkdirSync(nonGitDir, { recursive: true });
      process.chdir(nonGitDir);

      const result = await isGitRepository();
      expect(result).toBe(false);

      process.chdir(testRepo['repoPath']);
    });
  });

  describe('getStagedDiff', () => {
    it('should return empty string when no staged changes', async () => {
      const diff = await getStagedDiff();
      expect(diff).toBe('');
    });

    it('should return diff for staged file', async () => {
      await testRepo.createFile('test.txt', 'test content');
      await testRepo.stageFile('test.txt');

      const diff = await getStagedDiff();
      expect(diff).toContain('test.txt');
      expect(diff).toContain('test content');
    });

    it('should throw error when not in git repo', async () => {
      const nonGitDir = join(tmpdir(), `non-git-${randomUUID()}`);
      require('fs').mkdirSync(nonGitDir, { recursive: true });
      process.chdir(nonGitDir);

      await expect(getStagedDiff()).rejects.toThrow();

      process.chdir(testRepo['repoPath']);
    });
  });

  describe('stageAllChanges', () => {
    it('should stage all changes', async () => {
      await testRepo.createFile('file1.txt', 'content1');
      await testRepo.createFile('file2.txt', 'content2');

      await stageAllChanges();

      const diff = await getStagedDiff();
      expect(diff).toContain('file1.txt');
      expect(diff).toContain('file2.txt');
    });
  });

  describe('hasChanges', () => {
    it('should return false when no changes', async () => {
      const result = await hasChanges();
      expect(result).toBe(false);
    });

    it('should return true when there are staged changes', async () => {
      await testRepo.createFile('test.txt', 'content');
      await testRepo.stageFile('test.txt');

      const result = await hasChanges();
      expect(result).toBe(true);
    });

    it('should return true when there are unstaged changes', async () => {
      await testRepo.createFile('test.txt', 'content');
      // Don't stage

      const result = await hasChanges();
      expect(result).toBe(true);
    });
  });

  describe('commit', () => {
    it('should commit with message', async () => {
      await testRepo.createFile('test.txt', 'content');
      await testRepo.stageFile('test.txt');

      await gitCommit('test: commit message');

      const commits = await testRepo.getCommits();
      expect(commits.length).toBe(1);
      expect(commits[0]).toContain('test: commit message');
    });

    it('should commit with extra args', async () => {
      await testRepo.createFile('test.txt', 'content');
      await testRepo.stageFile('test.txt');

      await gitCommit('test: commit', ['--no-verify']);

      const commits = await testRepo.getCommits();
      expect(commits.length).toBe(1);
    });
  });

  describe('getCurrentBranch', () => {
    it('should return current branch name', async () => {
      const branch = await getCurrentBranch();
      // Default branch could be 'main' or 'master'
      expect(['main', 'master']).toContain(branch);
    });
  });
});

