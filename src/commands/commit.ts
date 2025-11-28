import chalk from 'chalk';
import * as p from '@clack/prompts';
import ora from 'ora';
import {
    getStagedDiff,
    stageAllChanges,
    commit as gitCommit,
    isGitRepository,
    hasChanges
} from '../utils/git';
import { generateCommitMessageByDiff } from '../generateCommitMessage';
import { getConfig } from '../utils/config';

export const commit = async (
    extraArgs: string[] = [],
    context: string = '',
    isHook: boolean = false,
    fullGitMojiSpec: boolean = false,
    skipConfirmation: boolean = false
): Promise<void> => {
    try {
        // Check if we're in a git repository
        const isRepo = await isGitRepository();
        if (!isRepo) {
            console.error(
                chalk.red('❌ Not a git repository. Please run this command in a git repository.')
            );
            process.exit(1);
        }

        // Check if there are any changes
        const hasAnyChanges = await hasChanges();
        if (!hasAnyChanges) {
            console.log(chalk.yellow('⚠️  No changes detected. Nothing to commit.'));
            process.exit(0);
        }

        // Get staged diff
        let diff = await getStagedDiff();

        // If no staged changes, ask to stage all
        if (!diff || diff.trim().length === 0) {
            const shouldStageAll = await p.confirm({
                message: 'No staged changes. Stage all changes?',
                initialValue: true
            });

            if (p.isCancel(shouldStageAll) || !shouldStageAll) {
                console.log(chalk.yellow('Cancelled.'));
                process.exit(0);
            }

            const spinner = ora('Staging all changes...').start();
            await stageAllChanges();
            spinner.succeed('Changes staged');

            diff = await getStagedDiff();
        }

        if (!diff || diff.trim().length === 0) {
            console.error(chalk.red('❌ No changes to commit.'));
            process.exit(1);
        }

        // Check for API key
        const config = getConfig();
        if (!config.ACP_API_KEY && config.ACP_AI_PROVIDER !== 'ollama') {
            console.error(
                chalk.red(
                    '❌ API key not configured. Please run: smc config set ACP_API_KEY=<your_api_key>'
                )
            );
            process.exit(1);
        }

        // Generate commit message
        const spinner = ora('Generating commit message...').start();
        let commitMessage: string;

        try {
            commitMessage = await generateCommitMessageByDiff(
                diff,
                fullGitMojiSpec,
                context
            );
            spinner.succeed('Commit message generated');
        } catch (error) {
            spinner.fail('Failed to generate commit message');
            throw error;
        }

        // Display the generated message
        console.log('\n' + chalk.cyan('📝 Generated commit message:'));
        console.log(chalk.white('─'.repeat(50)));
        console.log(chalk.green(commitMessage));
        console.log(chalk.white('─'.repeat(50)) + '\n');

        // Ask for confirmation unless --yes flag is used
        if (!skipConfirmation && !isHook) {
            const shouldCommit = await p.confirm({
                message: 'Commit with this message?',
                initialValue: true
            });

            if (p.isCancel(shouldCommit) || !shouldCommit) {
                console.log(chalk.yellow('Commit cancelled.'));
                process.exit(0);
            }
        }

        // Commit
        const commitSpinner = ora('Committing changes...').start();
        try {
            await gitCommit(commitMessage, extraArgs);
            commitSpinner.succeed(chalk.green('✅ Changes committed successfully!'));
        } catch (error) {
            commitSpinner.fail('Failed to commit');
            throw error;
        }
    } catch (error) {
        const err = error as Error;
        console.error(chalk.red(`\n❌ Error: ${err.message}`));
        process.exit(1);
    }
};
