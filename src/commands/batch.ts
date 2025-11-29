import { command } from 'cleye';
import chalk from 'chalk';
import * as p from '@clack/prompts';
import ora from 'ora';
import {
    getStagedDiff,
    getUnstagedDiff,
    isGitRepository,
    hasChanges,
    stageFiles,
    commit as gitCommit,
    getCurrentBranch,
    hasRemote,
    push
} from '../utils/git';
import { getConfig } from '../utils/config';
import { saveCommitToHistory } from '../utils/storage';
import { analyzeBranch } from '../utils/branchAnalysis';
import {
    splitDiffByFiles,
    suggestLogicalGroupings,
    generateBatchCommits,
    FileGroup
} from '../utils/batchCommit';

export const batchCommand = command(
    {
        name: 'batch',
        parameters: ['[count]'],
        flags: {
            all: {
                type: Boolean,
                alias: 'a',
                description: 'Include unstaged changes',
                default: false
            },
            yes: {
                type: Boolean,
                alias: 'y',
                description: 'Skip confirmation prompts',
                default: false
            },
            context: {
                type: String,
                alias: 'c',
                description: 'Additional context for commit messages',
                default: ''
            },
            fgm: {
                type: Boolean,
                description: 'Use full GitMoji specification',
                default: false
            }
        }
    },
    async (argv) => {
        try {
            // Parse commit count from parameters
            const countParam = argv._.count;
            const commitCount = countParam ? parseInt(countParam as string, 10) : undefined;

            if (commitCount !== undefined) {
                if (isNaN(commitCount) || commitCount < 1) {
                    console.error(chalk.red('❌ Invalid commit count. Must be a positive number (e.g., acp batch 3)'));
                    process.exit(1);
                }
            }

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

            // Get diffs
            let diff = await getStagedDiff();
            const unstagedDiff = argv.flags.all ? await getUnstagedDiff() : '';

            // If no staged changes and --all flag, use unstaged
            if ((!diff || diff.trim().length === 0) && unstagedDiff && unstagedDiff.trim().length > 0) {
                diff = unstagedDiff;
            }

            // Combine staged and unstaged if both exist
            if (diff && unstagedDiff && unstagedDiff.trim().length > 0) {
                diff = diff + '\n' + unstagedDiff;
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

            // If no commit count specified, show usage
            if (!commitCount) {
                console.log(chalk.cyan('Usage: acp batch <number>'));
                console.log(chalk.gray('Example: acp batch 3  (splits changes into 3 commits)'));
                console.log(chalk.gray('Flags:'));
                console.log(chalk.gray('  --all, -a     Include unstaged changes'));
                console.log(chalk.gray('  --yes, -y     Skip confirmation prompts'));
                console.log(chalk.gray('  --context, -c Add context to commit messages'));
                process.exit(0);
            }

            // Split diff into files
            const spinner = ora('Analyzing changes...').start();
            const fileDiffs = await splitDiffByFiles(diff, argv.flags.all);
            
            if (fileDiffs.length === 0) {
                spinner.fail('No file changes detected');
                console.error(chalk.red('❌ No file changes detected in diff.'));
                process.exit(1);
            }
            
            spinner.succeed(`Found ${fileDiffs.length} file(s) with changes`);

            if (fileDiffs.length === 0) {
                console.error(chalk.red('❌ No file changes detected in diff.'));
                process.exit(1);
            }

            if (commitCount > fileDiffs.length) {
                console.error(
                    chalk.red(`❌ Cannot create ${commitCount} commits from ${fileDiffs.length} file(s). Maximum: ${fileDiffs.length}`)
                );
                process.exit(1);
            }

            // Use AI to group files into the requested number of commits
            const currentBranch = await getCurrentBranch();
            const branchContext = analyzeBranch(currentBranch);
            
            const groupingSpinner = ora(`🤖 Splitting ${fileDiffs.length} file(s) into ${commitCount} logical commit(s)...`).start();
            let groups: FileGroup[];
            
            try {
                groups = await suggestLogicalGroupings(fileDiffs, branchContext, commitCount);
                
                // Ensure we have the right number of groups
                if (groups.length !== commitCount) {
                    // Adjust groups to match target count
                    if (groups.length > commitCount) {
                        // Merge smallest groups until we reach target
                        while (groups.length > commitCount && groups.length > 1) {
                            groups.sort((a, b) => a.totalSize - b.totalSize);
                            const smallest = groups[0];
                            const second = groups[1];
                            groups[0] = {
                                id: `merged-${Date.now()}`,
                                name: `${smallest.name} + ${second.name}`,
                                description: `Merged: ${smallest.description || smallest.name} and ${second.description || second.name}`,
                                files: [...smallest.files, ...second.files],
                                totalSize: smallest.totalSize + second.totalSize
                            };
                            groups.splice(1, 1);
                        }
                    } else if (groups.length < commitCount) {
                        // Split largest group until we reach target
                        while (groups.length < commitCount && groups.length > 0) {
                            groups.sort((a, b) => b.totalSize - a.totalSize);
                            const largest = groups[0];
                            if (largest.files.length <= 1) break; // Can't split single file
                            
                            // Split in half
                            const mid = Math.floor(largest.files.length / 2);
                            const firstHalf = largest.files.slice(0, mid);
                            const secondHalf = largest.files.slice(mid);
                            
                            groups[0] = {
                                id: `${largest.id}-1`,
                                name: `${largest.name} (part 1)`,
                                description: largest.description,
                                files: firstHalf,
                                totalSize: firstHalf.reduce((sum, f) => sum + f.size, 0)
                            };
                            
                            groups.push({
                                id: `${largest.id}-2`,
                                name: `${largest.name} (part 2)`,
                                description: largest.description,
                                files: secondHalf,
                                totalSize: secondHalf.reduce((sum, f) => sum + f.size, 0)
                            });
                        }
                    }
                }
                
                groupingSpinner.succeed(`Grouped into ${groups.length} commit(s)`);
            } catch (error) {
                groupingSpinner.fail('AI grouping failed, using fallback grouping');
                // Fallback: distribute files evenly
                groups = [];
                const filesPerCommit = Math.ceil(fileDiffs.length / commitCount);
                for (let i = 0; i < commitCount; i++) {
                    const start = i * filesPerCommit;
                    const end = Math.min(start + filesPerCommit, fileDiffs.length);
                    const commitFiles = fileDiffs.slice(start, end);
                    if (commitFiles.length > 0) {
                        groups.push({
                            id: `commit-${i + 1}`,
                            name: `Commit ${i + 1}`,
                            description: `${commitFiles.length} file(s)`,
                            files: commitFiles,
                            totalSize: commitFiles.reduce((sum, f) => sum + f.size, 0)
                        });
                    }
                }
            }

            if (groups.length === 0) {
                console.error(chalk.red('❌ No file groups created.'));
                process.exit(1);
            }

            // Display groups
            console.log(chalk.cyan(`\n📦 Will create ${groups.length} commit(s):\n`));
            groups.forEach((group, index) => {
                const fileList = group.files.length <= 5
                    ? group.files.map(f => f.filePath).join(', ')
                    : `${group.files.slice(0, 3).map(f => f.filePath).join(', ')} and ${group.files.length - 3} more`;
                
                console.log(
                    chalk.gray(`${(index + 1).toString().padStart(3)}. `) +
                    chalk.white(chalk.bold(group.name)) +
                    chalk.gray(` (${group.files.length} file${group.files.length > 1 ? 's' : ''})`)
                );
                
                if (group.description) {
                    console.log(
                        chalk.gray('     ') +
                        chalk.italic(chalk.dim(group.description))
                    );
                }
                
                console.log(
                    chalk.gray('     Files: ') +
                    chalk.dim(fileList)
                );
                console.log('');
            });

            // Generate commit messages for all groups
            const generateSpinner = ora('Generating commit messages...').start();
            const commitGroups = await generateBatchCommits(
                groups,
                argv.flags.fgm,
                argv.flags.context,
                branchContext
            );
            generateSpinner.succeed(`Generated ${commitGroups.length} commit message(s)`);
            
            // Filter out groups that have no valid files
            const validCommitGroups = commitGroups.filter(group => {
                const validFiles = group.files.filter(f => {
                    const fp = f.filePath;
                    return fp && 
                           !fp.includes('\n') && 
                           !fp.includes('${') &&
                           fp.length < 500 &&
                           fp.length > 0 &&
                           (fp.startsWith('/') || fp.match(/^[\w\.\-]/));
                });
                return validFiles.length > 0;
            });
            
            if (validCommitGroups.length === 0) {
                console.error(chalk.red('❌ No valid files to commit in any group.'));
                process.exit(1);
            }
            
            if (validCommitGroups.length < commitGroups.length) {
                console.warn(chalk.yellow(`⚠️  Filtered out ${commitGroups.length - validCommitGroups.length} group(s) with invalid files.`));
            }

            // Display preview
            console.log(chalk.cyan(`\n📝 Commit Messages (${validCommitGroups.length} commit(s)):\n`));
            validCommitGroups.forEach((group, index) => {
                console.log(
                    chalk.gray(`${(index + 1).toString().padStart(3)}. `) +
                    chalk.white(chalk.bold(group.name))
                );
                console.log(chalk.gray('   Message: ') + chalk.green(group.message));
                if (group.description) {
                    console.log(chalk.gray('   Reason: ') + chalk.dim(group.description));
                }
                console.log('');
            });

            // Confirm before proceeding (unless --yes flag)
            if (!argv.flags.yes) {
                const shouldProceed = await p.confirm({
                    message: `Proceed with ${validCommitGroups.length} commit(s)?`,
                    initialValue: true
                });

                if (p.isCancel(shouldProceed) || !shouldProceed) {
                    console.log(chalk.yellow('Cancelled.'));
                    process.exit(0);
                }
            }

            // Execute commits
            const commitSpinner = ora('Committing changes...').start();
            let successCount = 0;
            const { execa } = await import('execa');

            for (let i = 0; i < validCommitGroups.length; i++) {
                const group = validCommitGroups[i];
                
                try {
                    // Get all files that currently have changes (staged or unstaged)
                    const { stdout: allStagedFiles } = await execa('git', ['diff', '--cached', '--name-only'], { reject: false });
                    const { stdout: allUnstagedFiles } = await execa('git', ['diff', '--name-only'], { reject: false });
                    const availableFiles = new Set<string>();
                    
                    if (allStagedFiles) {
                        allStagedFiles.split('\n').forEach(f => {
                            const trimmed = f.trim();
                            if (trimmed) availableFiles.add(trimmed);
                        });
                    }
                    if (allUnstagedFiles) {
                        allUnstagedFiles.split('\n').forEach(f => {
                            const trimmed = f.trim();
                            if (trimmed) availableFiles.add(trimmed);
                        });
                    }
                    
                    // Filter group files to only those that still have changes
                    const filePaths = group.files
                        .map(f => f.filePath)
                        .filter(fp => {
                            // Basic validation
                            if (!fp || 
                                fp.includes('\n') || 
                                fp.includes('${') ||
                                fp.length >= 500 ||
                                fp.length === 0 ||
                                !(fp.startsWith('/') || fp.match(/^[\w\.\-]/))) {
                                return false;
                            }
                            // Only include files that still have changes
                            return availableFiles.has(fp);
                        });
                    
                    if (filePaths.length === 0) {
                        console.warn(chalk.yellow(`⚠️  No changes to commit in group: ${group.name} (files may have been committed already)`));
                        continue;
                    }
                    
                    // Stage the files
                    await stageFiles(filePaths);

                    // Verify we have something staged to commit
                    const { stdout: stagedDiff } = await execa('git', ['diff', '--cached', '--name-only'], { reject: false });
                    if (!stagedDiff || stagedDiff.trim().length === 0) {
                        console.warn(chalk.yellow(`⚠️  Nothing staged for commit in group: ${group.name}`));
                        continue;
                    }

                    // Commit
                    await gitCommit(group.message);
                    saveCommitToHistory(group.message, currentBranch);
                    successCount++;

                    if (i < validCommitGroups.length - 1) {
                        commitSpinner.text = `Committed ${successCount}/${validCommitGroups.length}...`;
                    }
                } catch (error) {
                    commitSpinner.fail(`Failed to commit ${group.name}`);
                    const err = error as Error;
                    console.error(chalk.red(`Error: ${err.message}`));
                    // Show which files were attempted
                    const attemptedFiles = group.files.map(f => f.filePath).join(', ');
                    console.error(chalk.dim(`Files: ${attemptedFiles}`));
                    // Continue with next commit
                }
            }

            commitSpinner.succeed(chalk.green(`✅ Successfully committed ${successCount} of ${validCommitGroups.length} commit(s)!`));

            // Ask to push (unless --yes flag)
            if (!argv.flags.yes) {
                const shouldPush = await p.confirm({
                    message: `Push all commits to remote (${currentBranch})?`,
                    initialValue: true
                });

                if (!p.isCancel(shouldPush) && shouldPush) {
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
                        }
                    }
                } else if (p.isCancel(shouldPush)) {
                    console.log(chalk.yellow('Push cancelled.'));
                }
            }
        } catch (error) {
            const err = error as Error;
            console.error(chalk.red(`\n❌ Error: ${err.message}`));
            process.exit(1);
        }
    }
);

