import chalk from 'chalk';
import * as p from '@clack/prompts';
import ora from 'ora';
import { writeFileSync } from 'fs';
import {
    getStagedDiff,
    stageAllChanges,
    commit as gitCommit,
    isGitRepository,
    hasChanges,
    hasRemote,
    push,
    getCurrentBranch
} from '../utils/git';
import { generateCommitMessageByDiff } from '../generateCommitMessage';
import { getConfig } from '../utils/config';
import { estimateCost } from '../utils/costEstimation';
import { saveCommitToHistory } from '../utils/storage';
import { analyzeBranch } from '../utils/branchAnalysis';

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
                    '❌ API key not configured. Please run: acp config set ACP_API_KEY=<your_api_key>'
                )
            );
            process.exit(1);
        }

        // Quick cost estimation before generating (using fast approximation)
        const costEstimate = await estimateCost(diff, fullGitMojiSpec, context);
        
        // Show confirmation with cost and token information
        if (!skipConfirmation && !isHook) {
            const costDisplay = costEstimate.estimatedCost > 0
                ? `${costEstimate.costCurrency}${costEstimate.estimatedCost.toFixed(6)}`
                : 'Free (local)';
            
            const costInfo = [
                chalk.cyan('📊 Usage Estimate:'),
                `   Input tokens: ${chalk.yellow(costEstimate.inputTokens.toLocaleString())}`,
                `   Output tokens (estimated): ${chalk.yellow(costEstimate.outputTokens.toLocaleString())}`,
                `   Estimated cost: ${chalk.green(costDisplay)}`
            ].join('\n');

            console.log('\n' + costInfo + '\n');

            const shouldProceed = await p.confirm({
                message: 'Proceed with generating commit message?',
                initialValue: true
            });

            if (p.isCancel(shouldProceed) || !shouldProceed) {
                console.log(chalk.yellow('Cancelled.'));
                process.exit(0);
            }
        }

        // Get branch context
        const currentBranch = await getCurrentBranch();
        const branchContext = analyzeBranch(currentBranch);

        // Generate commit message
        const spinner = isHook ? null : ora('Generating commit message...').start();
        let commitMessage: string;
        const startTime = Date.now();

        try {
            commitMessage = await generateCommitMessageByDiff(
                diff,
                fullGitMojiSpec,
                context,
                branchContext
            );
            const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2);
            if (spinner) {
                spinner.succeed(`Commit message generated (${elapsedTime}s)`);
            }
        } catch (error) {
            if (spinner) {
                spinner.fail('Failed to generate commit message');
            }
            throw error;
        }

        // In hook mode, write to commit message file and exit
        if (isHook) {
            // The commit message file path is passed as the first argument after --hook-mode
            // Find the argument that's not a flag and not 'acp' or script name
            const args = process.argv.slice(2); // Skip node and script path
            const hookModeIndex = args.indexOf('--hook-mode');
            const commitMsgFile = hookModeIndex >= 0 && args[hookModeIndex + 1] 
                ? args[hookModeIndex + 1] 
                : args.find(arg => !arg.startsWith('--') && !arg.includes('acp') && !arg.includes('node'));
            
            if (commitMsgFile && commitMsgFile !== '--hook-mode' && !commitMsgFile.startsWith('-')) {
                try {
                    writeFileSync(commitMsgFile, commitMessage, 'utf-8');
                    // Exit successfully - hook mode should be silent
                    return;
                } catch (error) {
                    // Fail silently in hook mode
                    return;
                }
            }
            // If no file path provided, just output the message (fallback)
            process.stdout.write(commitMessage);
            return;
        }

        // Display the generated message
        console.log('\n' + chalk.cyan('📝 Generated commit message:'));
        console.log(chalk.white('─'.repeat(50)));
        console.log(chalk.green(commitMessage));
        console.log(chalk.white('─'.repeat(50)) + '\n');

        // Ask for confirmation unless --yes flag is used
        if (!skipConfirmation) {
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
            
            // Save to history
            saveCommitToHistory(commitMessage, currentBranch);
        } catch (error) {
            commitSpinner.fail('Failed to commit');
            throw error;
        }

        // Ask to push
        const shouldPush = await p.confirm({
            message: `Push changes to remote (${currentBranch})?`,
            initialValue: true
        });

        if (!p.isCancel(shouldPush) && shouldPush) {
            // Check if remote exists before attempting push
            const hasRemoteRepo = await hasRemote();
            if (!hasRemoteRepo) {
                console.log(chalk.yellow('⚠️  No remote repository configured. Skipping push.'));
            } else {
                const pushSpinner = ora('Pushing to remote...').start();
                try {
                    await push();
                    pushSpinner.succeed(chalk.green('✅ Changes pushed successfully!'));
                } catch (error) {
                    pushSpinner.fail('Failed to push');
                    const err = error as Error;
                    console.error(chalk.yellow(`\n⚠️  Push failed: ${err.message}`));
                    // Don't exit with error, commit was successful
                }
            }
        } else if (p.isCancel(shouldPush)) {
            console.log(chalk.yellow('Push cancelled.'));
        }
    } catch (error) {
        const err = error as Error;
        console.error(chalk.red(`\n❌ Error: ${err.message}`));
        process.exit(1);
    }
};
