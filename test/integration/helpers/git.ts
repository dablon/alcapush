import { execSync } from 'child_process';
import { existsSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';

export class TestGitRepo {
  public readonly repoPath: string;
  private originalCwd: string;

  constructor(repoPath: string) {
    this.repoPath = repoPath;
    this.originalCwd = process.cwd();
  }

  async init(): Promise<void> {
    // Clean up if exists
    if (existsSync(this.repoPath)) {
      rmSync(this.repoPath, { recursive: true, force: true });
    }
    mkdirSync(this.repoPath, { recursive: true });
    
    process.chdir(this.repoPath);
    
    // Initialize git repo
    execSync('git init', { stdio: 'pipe' });
    execSync('git config user.name "Test User"', { stdio: 'pipe' });
    execSync('git config user.email "test@example.com"', { stdio: 'pipe' });
  }

  async createFile(filename: string, content: string): Promise<void> {
    const filePath = join(this.repoPath, filename);
    const dirPath = join(filePath, '..');
    
    // Create directory structure if it doesn't exist
    if (!existsSync(dirPath)) {
      mkdirSync(dirPath, { recursive: true });
    }
    
    writeFileSync(filePath, content);
  }

  async stageFile(filename: string): Promise<void> {
    execSync(`git add ${filename}`, { stdio: 'pipe', cwd: this.repoPath });
  }

  async stageAll(): Promise<void> {
    execSync('git add -A', { stdio: 'pipe', cwd: this.repoPath });
  }

  async commit(message: string): Promise<void> {
    execSync(`git commit -m "${message}"`, { stdio: 'pipe', cwd: this.repoPath });
  }

  async getStagedDiff(): Promise<string> {
    try {
      return execSync('git diff --cached', { encoding: 'utf-8', cwd: this.repoPath });
    } catch {
      return '';
    }
  }

  async getCommits(): Promise<string[]> {
    try {
      const output = execSync('git log --oneline', { encoding: 'utf-8', cwd: this.repoPath });
      return output.trim().split('\n').filter(Boolean);
    } catch {
      return [];
    }
  }

  async getLastCommitMessage(): Promise<string> {
    try {
      return execSync('git log -1 --pretty=%B', { encoding: 'utf-8', cwd: this.repoPath }).trim();
    } catch {
      return '';
    }
  }

  async runGit(args: string[]): Promise<void> {
    execSync(`git ${args.join(' ')}`, { stdio: 'pipe', cwd: this.repoPath });
  }

  async cleanup(): Promise<void> {
    process.chdir(this.originalCwd);
    if (existsSync(this.repoPath)) {
      rmSync(this.repoPath, { recursive: true, force: true });
    }
  }
}

