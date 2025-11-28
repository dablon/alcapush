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
