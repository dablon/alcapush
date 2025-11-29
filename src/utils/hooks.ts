import { execa } from 'execa';
import { existsSync, mkdirSync, writeFileSync, readFileSync, chmodSync, unlinkSync } from 'fs';
import { join } from 'path';
import { isGitRepository } from './git';

const HOOKS_DIR = '.git/hooks';
const PREPARE_COMMIT_MSG_HOOK = 'prepare-commit-msg';
const COMMIT_MSG_HOOK = 'commit-msg';

/**
 * Get the path to the git hooks directory
 */
const getHooksDir = async (): Promise<string> => {
    const isRepo = await isGitRepository();
    if (!isRepo) {
        throw new Error('Not a git repository. Please run this command in a git repository.');
    }

    // Get git directory
    const { stdout } = await execa('git', ['rev-parse', '--git-dir']);
    const gitDir = stdout.trim();
    
    // Handle both .git (normal) and bare repos
    const hooksDir = gitDir.endsWith('.git') 
        ? join(gitDir, 'hooks')
        : join(gitDir, 'hooks');
    
    return hooksDir;
};

/**
 * Get the path to the acp binary
 * This will work for both installed packages and local development
 */
const getAcpBinaryPath = (): string => {
    // Try to find acp in PATH first
    // In production, acp should be in PATH
    // For development, we can use the built CLI
    try {
        // Check if we're in a built environment
        // @ts-ignore - __dirname is available in CJS builds
        if (typeof __dirname !== 'undefined') {
            // Built version - acp should be in PATH
            return 'acp';
        }
    } catch {
        // Dev environment
    }
    
    // Default: assume acp is in PATH (installed via npm)
    return 'acp';
};

/**
 * Generate prepare-commit-msg hook content
 */
const generatePrepareCommitMsgHook = (): string => {
    const acpPath = getAcpBinaryPath();
    return `#!/bin/sh
# Alcapush prepare-commit-msg hook
# This hook automatically generates commit messages when git commit is called

# Only run if commit message is empty or contains only comments
if [ -z "$(cat "$1" | grep -v '^#' | grep -v '^$')" ]; then
    # Generate commit message using acp and write to commit message file
    ${acpPath} --hook-mode "$1" 2>/dev/null || true
fi
`;
};

/**
 * Generate commit-msg hook content for validation
 */
const generateCommitMsgHook = (): string => {
    const acpPath = getAcpBinaryPath();
    return `#!/bin/sh
# Alcapush commit-msg hook
# This hook validates commit messages against Conventional Commits

commit_msg_file="$1"
commit_msg=$(cat "$commit_msg_file")

# Validate using acp
${acpPath} --validate-commit-msg "$commit_msg_file" || exit 1
`;
};

/**
 * Check if a hook is already installed
 */
const isHookInstalled = async (hookName: string): Promise<boolean> => {
    try {
        const hooksDir = await getHooksDir();
        const hookPath = join(hooksDir, hookName);
        
        if (!existsSync(hookPath)) {
            return false;
        }
        
        const content = readFileSync(hookPath, 'utf-8');
        return content.includes('Alcapush') || content.includes('alcapush');
    } catch {
        return false;
    }
};

/**
 * Install git hooks
 */
export const installHooks = async (): Promise<void> => {
    const isRepo = await isGitRepository();
    if (!isRepo) {
        throw new Error('Not a git repository. Please run this command in a git repository.');
    }

    const hooksDir = await getHooksDir();
    
    // Create hooks directory if it doesn't exist
    if (!existsSync(hooksDir)) {
        mkdirSync(hooksDir, { recursive: true });
    }

    const installedHooks: string[] = [];

    // Install prepare-commit-msg hook
    const prepareCommitMsgPath = join(hooksDir, PREPARE_COMMIT_MSG_HOOK);
    const prepareCommitMsgContent = generatePrepareCommitMsgHook();
    
    // Check if hook already exists and is not ours
    if (existsSync(prepareCommitMsgPath)) {
        const existingContent = readFileSync(prepareCommitMsgPath, 'utf-8');
        if (!existingContent.includes('Alcapush') && !existingContent.includes('alcapush')) {
            // Backup existing hook
            const backupPath = `${prepareCommitMsgPath}.backup`;
            writeFileSync(backupPath, existingContent);
            // Append our hook to existing hook
            writeFileSync(prepareCommitMsgPath, existingContent + '\n\n' + prepareCommitMsgContent);
        } else {
            // Already installed, just update
            writeFileSync(prepareCommitMsgPath, prepareCommitMsgContent);
        }
    } else {
        writeFileSync(prepareCommitMsgPath, prepareCommitMsgContent);
    }
    
    chmodSync(prepareCommitMsgPath, 0o755);
    installedHooks.push(PREPARE_COMMIT_MSG_HOOK);

    // Install commit-msg hook
    const commitMsgPath = join(hooksDir, COMMIT_MSG_HOOK);
    const commitMsgContent = generateCommitMsgHook();
    
    // Check if hook already exists and is not ours
    if (existsSync(commitMsgPath)) {
        const existingContent = readFileSync(commitMsgPath, 'utf-8');
        if (!existingContent.includes('Alcapush') && !existingContent.includes('alcapush')) {
            // Backup existing hook
            const backupPath = `${commitMsgPath}.backup`;
            writeFileSync(backupPath, existingContent);
            // Append our hook to existing hook
            writeFileSync(commitMsgPath, existingContent + '\n\n' + commitMsgContent);
        } else {
            // Already installed, just update
            writeFileSync(commitMsgPath, commitMsgContent);
        }
    } else {
        writeFileSync(commitMsgPath, commitMsgContent);
    }
    
    chmodSync(commitMsgPath, 0o755);
    installedHooks.push(COMMIT_MSG_HOOK);

    return;
};

/**
 * Uninstall git hooks
 */
export const uninstallHooks = async (): Promise<void> => {
    const isRepo = await isGitRepository();
    if (!isRepo) {
        throw new Error('Not a git repository. Please run this command in a git repository.');
    }

    const hooksDir = await getHooksDir();
    const removedHooks: string[] = [];

    // Remove prepare-commit-msg hook
    const prepareCommitMsgPath = join(hooksDir, PREPARE_COMMIT_MSG_HOOK);
    if (existsSync(prepareCommitMsgPath)) {
        const content = readFileSync(prepareCommitMsgPath, 'utf-8');
        
        if (content.includes('Alcapush') || content.includes('alcapush')) {
            // Check if there's a backup
            const backupPath = `${prepareCommitMsgPath}.backup`;
            if (existsSync(backupPath)) {
                // Restore backup
                const backupContent = readFileSync(backupPath, 'utf-8');
                writeFileSync(prepareCommitMsgPath, backupContent);
                unlinkSync(backupPath);
            } else {
                // Remove our hook content
                const lines = content.split('\n');
                const ourHookStart = lines.findIndex(line => 
                    line.includes('Alcapush') || line.includes('alcapush')
                );
                
                if (ourHookStart !== -1) {
                    // Remove our hook section
                    const newContent = lines.slice(0, ourHookStart).join('\n').trim();
                    if (newContent) {
                        writeFileSync(prepareCommitMsgPath, newContent);
                    } else {
                        // No other content, remove the file
                        unlinkSync(prepareCommitMsgPath);
                    }
                } else {
                    // Entire file is our hook, remove it
                    unlinkSync(prepareCommitMsgPath);
                }
            }
            removedHooks.push(PREPARE_COMMIT_MSG_HOOK);
        }
    }

    // Remove commit-msg hook
    const commitMsgPath = join(hooksDir, COMMIT_MSG_HOOK);
    if (existsSync(commitMsgPath)) {
        const content = readFileSync(commitMsgPath, 'utf-8');
        
        if (content.includes('Alcapush') || content.includes('alcapush')) {
            // Check if there's a backup
            const backupPath = `${commitMsgPath}.backup`;
            if (existsSync(backupPath)) {
                // Restore backup
                const backupContent = readFileSync(backupPath, 'utf-8');
                writeFileSync(commitMsgPath, backupContent);
                unlinkSync(backupPath);
            } else {
                // Remove our hook content
                const lines = content.split('\n');
                const ourHookStart = lines.findIndex(line => 
                    line.includes('Alcapush') || line.includes('alcapush')
                );
                
                if (ourHookStart !== -1) {
                    // Remove our hook section
                    const newContent = lines.slice(0, ourHookStart).join('\n').trim();
                    if (newContent) {
                        writeFileSync(commitMsgPath, newContent);
                    } else {
                        // No other content, remove the file
                        unlinkSync(commitMsgPath);
                    }
                } else {
                    // Entire file is our hook, remove it
                    unlinkSync(commitMsgPath);
                }
            }
            removedHooks.push(COMMIT_MSG_HOOK);
        }
    }

    return;
};

/**
 * Check if hooks are installed
 */
export const checkHooksInstalled = async (): Promise<{ prepareCommitMsg: boolean; commitMsg: boolean }> => {
    const prepareCommitMsg = await isHookInstalled(PREPARE_COMMIT_MSG_HOOK);
    const commitMsg = await isHookInstalled(COMMIT_MSG_HOOK);
    
    return { prepareCommitMsg, commitMsg };
};

