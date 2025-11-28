import { cli } from 'cleye';
import { commit } from './commands/commit';
import { configCommand } from './commands/config';
import chalk from 'chalk';
import { readFileSync } from 'fs';
import { join } from 'path';

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
  ${chalk.white('acp')}                    Generate commit message for staged changes
  ${chalk.white('acp --yes')}               Auto-commit without confirmation
  ${chalk.white('acp -c "context"')}       Add additional context
  ${chalk.white('acp config set KEY=VAL')} Set configuration
  ${chalk.white('acp config get KEY')}     Get configuration value
  ${chalk.white('acp config list')}        List all configuration

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
`
        }
    },
    async (argv) => {
        // If a command was matched (config), don't run the default commit handler
        // Commands are handled by cleye automatically, but check argv._ to be safe
        if (argv._.length > 0 && argv._[0] === 'config') {
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
