import { execa } from 'execa';

export const getStagedDiff = async (): Promise<string> => {
    try {
        const { stdout } = await execa('git', ['diff', '--cached']);
        return stdout;
    } catch (error) {
        throw new Error('Failed to get staged diff. Are you in a git repository?');
    }
};

export const getUnstagedDiff = async (): Promise<string> => {
    try {
        const { stdout } = await execa('git', ['diff']);
        return stdout;
    } catch (error) {
        throw new Error('Failed to get unstaged diff');
    }
};

export const stageAllChanges = async (): Promise<void> => {
    try {
        await execa('git', ['add', '-A']);
    } catch (error) {
        throw new Error('Failed to stage changes');
    }
};

export const commit = async (
    message: string,
    extraArgs: string[] = []
): Promise<void> => {
    try {
        // Check if there's anything staged first
        const { stdout: stagedFiles } = await execa('git', ['diff', '--cached', '--name-only'], { reject: false });
        if (!stagedFiles || stagedFiles.trim().length === 0) {
            throw new Error('No changes staged for commit');
        }
        
        await execa('git', ['commit', '-m', message, ...extraArgs]);
    } catch (error) {
        const err = error as Error;
        if (err.message.includes('No changes staged')) {
            throw err;
        }
        // Try to get more details from git error
        try {
            const { stderr } = error as any;
            if (stderr && stderr.includes('nothing to commit')) {
                throw new Error('No changes to commit (files may have been committed already)');
            }
        } catch {
            // Fall through to generic error
        }
        throw new Error(`Failed to commit changes: ${err.message}`);
    }
};

export const isGitRepository = async (): Promise<boolean> => {
    try {
        await execa('git', ['rev-parse', '--git-dir']);
        return true;
    } catch (error) {
        return false;
    }
};

export const getCurrentBranch = async (): Promise<string> => {
    try {
        const { stdout } = await execa('git', ['branch', '--show-current']);
        return stdout;
    } catch (error) {
        return 'main';
    }
};

export const hasChanges = async (): Promise<boolean> => {
    try {
        const staged = await getStagedDiff();
        const unstaged = await getUnstagedDiff();
        return staged.length > 0 || unstaged.length > 0;
    } catch (error) {
        return false;
    }
};

export const hasRemote = async (): Promise<boolean> => {
    try {
        const { stdout } = await execa('git', ['remote']);
        return stdout.trim().length > 0;
    } catch (error) {
        return false;
    }
};

export const getRemoteName = async (): Promise<string> => {
    try {
        const { stdout } = await execa('git', ['remote']);
        const remotes = stdout.trim().split('\n').filter(r => r.length > 0);
        // Prefer 'origin', otherwise use the first remote
        return remotes.includes('origin') ? 'origin' : (remotes[0] || 'origin');
    } catch (error) {
        return 'origin';
    }
};

export const push = async (remote?: string, branch?: string): Promise<void> => {
    try {
        const remoteName = remote || await getRemoteName();
        const branchName = branch || await getCurrentBranch();
        await execa('git', ['push', remoteName, branchName]);
    } catch (error) {
        throw new Error('Failed to push changes');
    }
};

/**
 * Check if a file exists in the working directory
 */
const fileExists = async (filePath: string): Promise<boolean> => {
    try {
        const { existsSync } = await import('fs');
        return existsSync(filePath);
    } catch {
        return false;
    }
};

/**
 * Get list of files that have changes (staged or unstaged)
 */
const getChangedFiles = async (): Promise<Set<string>> => {
    try {
        const { stdout } = await execa('git', ['diff', '--name-only', '--cached']);
        const { stdout: unstaged } = await execa('git', ['diff', '--name-only']);
        const allFiles = new Set<string>();
        
        stdout.split('\n').forEach(f => f.trim() && allFiles.add(f.trim()));
        unstaged.split('\n').forEach(f => f.trim() && allFiles.add(f.trim()));
        
        return allFiles;
    } catch {
        return new Set();
    }
};

/**
 * Stage specific files
 */
export const stageFiles = async (files: string[]): Promise<void> => {
    if (files.length === 0) {
        return;
    }
    
    // Get list of files that actually have changes in git
    const changedFiles = await getChangedFiles();
    
    // Filter to only files that have actual changes
    const validFiles = files.filter(file => {
        // Normalize paths (remove leading ./ if present)
        const normalized = file.replace(/^\.\//, '');
        return changedFiles.has(normalized) || changedFiles.has(file);
    });
    
    if (validFiles.length === 0) {
        // Try to stage anyway - might be new files
        const { existsSync } = await import('fs');
        const existingFiles = files.filter(f => existsSync(f));
        if (existingFiles.length === 0) {
            throw new Error(`No valid files to stage. Files checked: ${files.slice(0, 5).join(', ')}${files.length > 5 ? '...' : ''}`);
        }
        validFiles.push(...existingFiles);
    }
    
    try {
        await execa('git', ['add', ...validFiles]);
    } catch (error) {
        const err = error as Error;
        throw new Error(`Failed to stage files: ${err.message}. Files: ${validFiles.slice(0, 3).join(', ')}${validFiles.length > 3 ? '...' : ''}`);
    }
};

/**
 * Unstage specific files
 */
export const unstageFiles = async (files: string[]): Promise<void> => {
    if (files.length === 0) {
        return;
    }
    try {
        await execa('git', ['reset', 'HEAD', '--', ...files]);
    } catch (error) {
        throw new Error('Failed to unstage files');
    }
};

/**
 * Get diff for a specific file (staged or unstaged)
 */
export const getFileDiff = async (file: string, staged: boolean = true): Promise<string> => {
    try {
        const args = staged ? ['diff', '--cached', '--', file] : ['diff', '--', file];
        const { stdout } = await execa('git', args);
        return stdout;
    } catch (error) {
        // File might not have changes, return empty string
        return '';
    }
};