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
        await execa('git', ['commit', '-m', message, ...extraArgs]);
    } catch (error) {
        throw new Error('Failed to commit changes');
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
 * Stage specific files
 */
export const stageFiles = async (files: string[]): Promise<void> => {
    if (files.length === 0) {
        return;
    }
    try {
        await execa('git', ['add', ...files]);
    } catch (error) {
        throw new Error('Failed to stage files');
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