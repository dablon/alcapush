import { command } from 'cleye';
import chalk from 'chalk';
import { installHooks, uninstallHooks, checkHooksInstalled } from '../utils/hooks';
import ora from 'ora';

export const hookCommand = command(
    {
        name: 'hook',
        parameters: ['<subcommand>']
    },
    async (argv) => {
        const subcommand = argv._.subcommand;
        
        if (!subcommand) {
            console.log(chalk.yellow('Please specify a subcommand: install or uninstall'));
            return;
        }
        
        try {
            switch (subcommand) {
                case 'install': {
                    const spinner = ora('Installing git hooks...').start();
                    
                    try {
                        await installHooks();
                        spinner.succeed(chalk.green('✅ Git hooks installed successfully!'));
                        
                        console.log(chalk.cyan('\n📋 Installed hooks:'));
                        console.log(chalk.white('  • prepare-commit-msg - Automatically generates commit messages'));
                        console.log(chalk.white('  • commit-msg - Validates commit messages against Conventional Commits\n'));
                        
                        console.log(chalk.yellow('💡 Usage:'));
                        console.log(chalk.white('  Just run `git commit` and the hooks will automatically:'));
                        console.log(chalk.white('    1. Generate a commit message if none is provided'));
                        console.log(chalk.white('    2. Validate the commit message format\n'));
                    } catch (error) {
                        spinner.fail(chalk.red('Failed to install git hooks'));
                        const err = error as Error;
                        console.error(chalk.red(`\n❌ Error: ${err.message}`));
                        process.exit(1);
                    }
                    break;
                }
                
                case 'uninstall': {
                    const spinner = ora('Uninstalling git hooks...').start();
                    
                    try {
                        const status = await checkHooksInstalled();
                        
                        if (!status.prepareCommitMsg && !status.commitMsg) {
                            spinner.warn(chalk.yellow('No hooks found to uninstall'));
                            return;
                        }
                        
                        await uninstallHooks();
                        spinner.succeed(chalk.green('✅ Git hooks uninstalled successfully!'));
                        
                        console.log(chalk.cyan('\n📋 Removed hooks:'));
                        if (status.prepareCommitMsg) {
                            console.log(chalk.white('  • prepare-commit-msg'));
                        }
                        if (status.commitMsg) {
                            console.log(chalk.white('  • commit-msg'));
                        }
                        console.log('');
                    } catch (error) {
                        spinner.fail(chalk.red('Failed to uninstall git hooks'));
                        const err = error as Error;
                        console.error(chalk.red(`\n❌ Error: ${err.message}`));
                        process.exit(1);
                    }
                    break;
                }
                
                case 'status': {
                    const spinner = ora('Checking hook status...').start();
                    
                    try {
                        const status = await checkHooksInstalled();
                        spinner.stop();
                        
                        console.log(chalk.cyan('\n📋 Git hooks status:\n'));
                        console.log(
                            chalk.white('  prepare-commit-msg: ') +
                            (status.prepareCommitMsg ? chalk.green('✅ Installed') : chalk.gray('❌ Not installed'))
                        );
                        console.log(
                            chalk.white('  commit-msg: ') +
                            (status.commitMsg ? chalk.green('✅ Installed') : chalk.gray('❌ Not installed'))
                        );
                        console.log('');
                    } catch (error) {
                        spinner.fail(chalk.red('Failed to check hook status'));
                        const err = error as Error;
                        console.error(chalk.red(`\n❌ Error: ${err.message}`));
                        process.exit(1);
                    }
                    break;
                }
                
                default:
                    console.error(chalk.red(`❌ Unknown subcommand: ${subcommand}`));
                    console.log(chalk.yellow('Available subcommands: install, uninstall, status'));
                    process.exit(1);
            }
        } catch (error) {
            const err = error as Error;
            console.error(chalk.red(`\n❌ Error: ${err.message}`));
            process.exit(1);
        }
    }
);

