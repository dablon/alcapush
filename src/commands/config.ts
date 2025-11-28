import { cli } from 'cleye';
import chalk from 'chalk';
import {
    getConfig,
    setConfig,
    getConfigValue,
    describeConfig
} from '../utils/config';

export const configCommand = cli(
    {
        name: 'config',
        commands: [
            cli({
                name: 'set',
                parameters: ['<key=value...>']
            }),
            cli({
                name: 'get',
                parameters: ['<key>']
            }),
            cli({
                name: 'describe',
                parameters: ['[key]']
            }),
            cli({
                name: 'list'
            })
        ]
    },
    (argv) => {
        const command = argv.command;

        if (!command) {
            console.log(chalk.yellow('Please specify a subcommand: set, get, describe, or list'));
            return;
        }

        switch (command) {
            case 'set': {
                const params = argv._.parameters as string[];
                params.forEach((param) => {
                    const [key, ...valueParts] = param.split('=');
                    const value = valueParts.join('=');
                    if (key && value) {
                        setConfig(key, value);
                        console.log(chalk.green(`✅ Set ${key}=${value}`));
                    } else {
                        console.error(chalk.red(`❌ Invalid format: ${param}`));
                    }
                });
                break;
            }

            case 'get': {
                const key = (argv._.parameters as string[])[0];
                if (key) {
                    const value = getConfigValue(key);
                    if (value !== undefined) {
                        console.log(chalk.cyan(`${key}=`) + chalk.white(value));
                    } else {
                        console.log(chalk.yellow(`${key} is not set`));
                    }
                } else {
                    console.error(chalk.red('❌ Please specify a key'));
                }
                break;
            }

            case 'describe': {
                const key = (argv._.parameters as string[])[0];
                describeConfig(key);
                break;
            }

            case 'list': {
                const config = getConfig();
                console.log(chalk.cyan('\n📋 Current configuration:\n'));
                Object.entries(config).forEach(([key, value]) => {
                    // Hide API key for security
                    const displayValue = key === 'ACP_API_KEY' && value
                        ? '***' + value.slice(-4)
                        : value;
                    console.log(chalk.white(`  ${key}: `) + chalk.green(displayValue));
                });
                console.log('');
                break;
            }
        }
    }
);
