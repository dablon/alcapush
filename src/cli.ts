import { cli } from 'cleye';
import { commit } from './commands/commit';
import { configCommand } from './commands/config';
import { hookCommand } from './commands/hook';
import { historyCommand, favoriteCommand } from './commands/history';
import { batchCommand } from './commands/batch';
import chalk from 'chalk';
import { readFileSync } from 'fs';
import { join } from 'path';
import { validateCommitMessageFromFile } from './utils/commitValidation';

// Get package.json version dynamically
// Since esbuild bundles as CJS, __dirname will be available in the built version
// For dev mode, we'll use process.cwd()
const getPackageJSON = () => {
    try {
        // Try multiple paths to handle both dev and built environments
        // @ts-ignore - __dirname is available in CJS builds
        const builtPath = typeof __dirname !== 'undefined' 
            ? join(__dirname, '../package.json')
            : null;
        const devPath = join(process.cwd(), 'package.json');
        
        const paths = [builtPath, devPath].filter((p): p is string => p !== null);
        
        for (const packagePath of paths) {
            try {
                return JSON.parse(readFileSync(packagePath, 'utf-8'));
            } catch {
                continue;
            }
        }
        
        throw new Error('Could not find package.json');
    } catch {
        // Fallback if package.json can't be read
        return {
            name: 'alcapush',
            version: '1.0.0',
            description: 'AI-powered git commit message generator with GPT-5-nano support 🚀'
        };
    }
};

const packageJSON = getPackageJSON();

cli(
    {
        version: packageJSON.version,
        name: 'alcapush',
        commands: [configCommand, hookCommand, historyCommand, favoriteCommand, batchCommand],
        flags: {
            fgm: {
                type: Boolean,
                description: 'Use full GitMoji specification',
                default: false
            },
            context: {
                type: String,
                alias: 'c',
                description: 'Additional context for the commit message',
                default: ''
            },
            yes: {
                type: Boolean,
                alias: 'y',
                description: 'Skip commit confirmation prompt',
                default: false
            },
            'hook-mode': {
                type: Boolean,
                description: 'Run in hook mode (for prepare-commit-msg hook)',
                default: false
            },
            'validate-commit-msg': {
                type: String,
                description: 'Validate commit message file (for commit-msg hook)',
                default: ''
            }
        },
        ignoreArgv: (type) => type === 'unknown-flag',
        help: {
            description: packageJSON.description,
            usage: `
${chalk.cyan('Usage:')}
  ${chalk.white('acp')}                    Generate commit message for staged changes
  ${chalk.white('acp --yes')}               Auto-commit without confirmation
  ${chalk.white('acp -c "context"')}       Add additional context
            ${chalk.white('acp config set KEY=VAL')} Set configuration
            ${chalk.white('acp config get KEY')}     Get configuration value
            ${chalk.white('acp config list')}        List all configuration
            ${chalk.white('acp hook install')}       Install git hooks
            ${chalk.white('acp hook uninstall')}     Uninstall git hooks
            ${chalk.white('acp hook status')}        Check hook installation status
            ${chalk.white('acp history')}            View commit history
            ${chalk.white('acp history clear')}      Clear commit history
            ${chalk.white('acp favorite add MSG')}   Add message to favorites
            ${chalk.white('acp favorite remove MSG')} Remove message from favorites
            ${chalk.white('acp favorite list')}      List all favorites
            ${chalk.white('acp batch <N>')}          Split changes into N commits (AI-powered)
            ${chalk.white('acp batch 3')}             Split into 3 logical commits
            ${chalk.white('acp batch 3 --all')}      Include unstaged changes
            ${chalk.white('acp batch 3 --yes')}      Auto-commit without confirmation

${chalk.cyan('Examples:')}
  ${chalk.gray('# First time setup')}
  ${chalk.white('acp config set ACP_API_KEY=sk-...')}
  
  ${chalk.gray('# Use GPT-5-nano (or fallback to gpt-4o-mini)')}
  ${chalk.white('acp config set ACP_MODEL=gpt-5-nano')}
  
  ${chalk.gray('# Generate commit with emoji')}
  ${chalk.white('acp config set ACP_EMOJI=true')}
  ${chalk.white('acp')}
  
  ${chalk.gray('# Use with Anthropic Claude')}
  ${chalk.white('acp config set ACP_AI_PROVIDER=anthropic')}
  ${chalk.white('acp config set ACP_API_KEY=sk-ant-...')}
  
  ${chalk.gray('# Quick commit without confirmation')}
  ${chalk.white('acp --yes')}
  
  ${chalk.gray('# Split large diff into multiple commits')}
  ${chalk.white('acp batch')}
  
  ${chalk.gray('# Batch commit with directory grouping')}
  ${chalk.white('acp batch --group-by directory')}
`
        }
    },
    async (argv) => {
        // If a command was matched (config, hook, history, favorite, batch), don't run the default commit handler
        // Commands are handled by cleye automatically, but check argv._ to be safe
        if (argv._.length > 0 && (argv._[0] === 'config' || argv._[0] === 'hook' || argv._[0] === 'history' || argv._[0] === 'favorite' || argv._[0] === 'batch')) {
            return;
        }
        
        // Handle validate-commit-msg flag (for commit-msg hook)
        if (argv.flags['validate-commit-msg']) {
            try {
                const result = await validateCommitMessageFromFile(argv.flags['validate-commit-msg']);
                
                if (!result.valid) {
                    console.error(chalk.red('\n❌ Commit message validation failed:\n'));
                    result.errors.forEach(error => {
                        console.error(chalk.red(`  • ${error}`));
                    });
                    if (result.warnings.length > 0) {
                        console.log(chalk.yellow('\n⚠️  Warnings:'));
                        result.warnings.forEach(warning => {
                            console.log(chalk.yellow(`  • ${warning}`));
                        });
                    }
                    process.exit(1);
                }
                
                if (result.warnings.length > 0) {
                    console.log(chalk.yellow('\n⚠️  Commit message warnings:'));
                    result.warnings.forEach(warning => {
                        console.log(chalk.yellow(`  • ${warning}`));
                    });
                }
                
                // Validation passed
                process.exit(0);
            } catch (error) {
                const err = error as Error;
                console.error(chalk.red(`Error: ${err.message}`));
                process.exit(1);
            }
            return;
        }
        
        // Handle hook-mode flag (for prepare-commit-msg hook)
        if (argv.flags['hook-mode']) {
            try {
                await commit(process.argv.slice(2), argv.flags.context, true, argv.flags.fgm, true);
            } catch (error) {
                // In hook mode, fail silently to not interrupt git commit
                // The hook will just not generate a message if it fails
                process.exit(0);
            }
            return;
        }
        
        try {
            await commit(process.argv.slice(2), argv.flags.context, false, argv.flags.fgm, argv.flags.yes);
        } catch (error) {
            const err = error as Error;
            console.error(chalk.red(`Error: ${err.message}`));
            process.exit(1);
        }
    }
);
