import { cli } from 'cleye';
import { commit } from './commands/commit';
import { configCommand } from './commands/config';
import chalk from 'chalk';

const packageJSON = {
    name: 'alcapush',
    version: '1.0.0',
    description: 'AI-powered git commit message generator with GPT-5-nano support 🚀'
};

const result = cli(
    {
        version: packageJSON.version,
        name: 'alcapush',
        commands: [configCommand],
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
            }
        },
        ignoreArgv: (type) => type === 'unknown-flag',
        help: {
            description: packageJSON.description,
            usage: `
${chalk.cyan('Usage:')}
  ${chalk.white('smc')}                    Generate commit message for staged changes
  ${chalk.white('smc --yes')}              Auto-commit without confirmation
  ${chalk.white('smc -c "context"')}       Add additional context
  ${chalk.white('smc config set KEY=VAL')} Set configuration
  ${chalk.white('smc config get KEY')}     Get configuration value
  ${chalk.white('smc config list')}        List all configuration

${chalk.cyan('Examples:')}
  ${chalk.gray('# First time setup')}
  ${chalk.white('smc config set ACP_API_KEY=sk-...')}
  
  ${chalk.gray('# Use GPT-5-nano (or fallback to gpt-4o-mini)')}
  ${chalk.white('smc config set ACP_MODEL=gpt-5-nano')}
  
  ${chalk.gray('# Generate commit with emoji')}
  ${chalk.white('smc config set ACP_EMOJI=true')}
  ${chalk.white('smc')}
  
  ${chalk.gray('# Use with Anthropic Claude')}
  ${chalk.white('smc config set ACP_AI_PROVIDER=anthropic')}
  ${chalk.white('smc config set ACP_API_KEY=sk-ant-...')}
  
  ${chalk.gray('# Quick commit without confirmation')}
  ${chalk.white('smc --yes')}
`
        }
    },
    async (argv) => {
        // If a command was matched, don't run the default commit handler
        if (argv.command) {
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
