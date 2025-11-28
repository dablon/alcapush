import { command } from 'cleye';
import chalk from 'chalk';
import {
    getConfig,
    setConfig,
    getConfigValue,
    describeConfig
} from '../utils/config';
import { getEngine } from '../utils/engine';
import { OpenAI } from 'openai';
import ora from 'ora';

export const configCommand = command(
    {
        name: 'config',
        parameters: ['<subcommand>', '[args...]']
    },
    (argv) => {
        const subcommand = argv._.subcommand;
        const args = argv._.args || [];
        
        if (!subcommand) {
            console.log(chalk.yellow('Please specify a subcommand: set, get, describe, list, or test'));
            return;
        }
        
        // Manually route to subcommands
        const allArgs = [subcommand, ...args];
        
        switch (subcommand) {
            case 'set': {
                allArgs.forEach((param) => {
                    const [key, ...valueParts] = param.split('=');
                    const value = valueParts.join('=');
                    if (key && value) {
                        setConfig(key, value);
                        console.log(chalk.green(`✅ Set ${key}=${value}`));
                    } else if (key !== 'set') {
                        console.error(chalk.red(`❌ Invalid format: ${param}`));
                    }
                });
                break;
            }
            
            case 'get': {
                const key = allArgs[1];
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
                const key = allArgs[1];
                describeConfig(key);
                break;
            }
            
            case 'list': {
                const config = getConfig();
                console.log(chalk.cyan('\n📋 Current configuration:\n'));
                Object.entries(config).forEach(([key, value]) => {
                    // Hide API key for security
                    const valueStr = String(value);
                    const displayValue = key === 'ACP_API_KEY' && valueStr
                        ? '***' + valueStr.slice(-4)
                        : valueStr;
                    console.log(chalk.white(`  ${key}: `) + chalk.green(displayValue));
                });
                console.log('');
                break;
            }
            
            case 'test': {
                const config = getConfig();
                const spinner = ora('Testing connectivity...').start();
                
                // Validate configuration
                if (!config.ACP_API_KEY) {
                    spinner.fail(chalk.red('❌ API key not configured'));
                    console.log(chalk.yellow('\nPlease set your API key:'));
                    console.log(chalk.white('  acp config set ACP_API_KEY=your-api-key\n'));
                    return;
                }
                
                if (!config.ACP_MODEL) {
                    spinner.fail(chalk.red('❌ Model not configured'));
                    console.log(chalk.yellow('\nPlease set your model:'));
                    console.log(chalk.white('  acp config set ACP_MODEL=your-model\n'));
                    return;
                }
                
                // Display configuration being tested
                spinner.text = `Testing ${config.ACP_AI_PROVIDER} with model ${config.ACP_MODEL}...`;
                
                // Test connectivity
                (async () => {
                    try {
                        const engine = getEngine();
                        
                        // Create a simple test message
                        const testMessages: Array<OpenAI.Chat.Completions.ChatCompletionMessageParam> = [
                            {
                                role: 'user',
                                content: 'Say "OK" if you can read this.'
                            }
                        ];
                        
                        const response = await engine.generateCommitMessage(testMessages);
                        
                        if (response && response.trim()) {
                            spinner.succeed(chalk.green('✅ Connection successful!'));
                            console.log(chalk.cyan('\n📊 Configuration Summary:'));
                            console.log(chalk.white(`  Provider: `) + chalk.green(config.ACP_AI_PROVIDER || 'openai'));
                            
                            // Show actual model used (may differ if fallback occurred)
                            const actualModel = engine.config.model;
                            if (actualModel !== config.ACP_MODEL) {
                                console.log(chalk.white(`  Model: `) + chalk.yellow(`${config.ACP_MODEL} → ${actualModel} (fallback)`));
                            } else {
                                console.log(chalk.white(`  Model: `) + chalk.green(actualModel));
                            }
                            
                            console.log(chalk.white(`  API Key: `) + chalk.green('***' + String(config.ACP_API_KEY).slice(-4)));
                            if (config.ACP_API_URL) {
                                console.log(chalk.white(`  API URL: `) + chalk.green(config.ACP_API_URL));
                            }
                            console.log(chalk.gray(`\n  Response: ${response.trim()}\n`));
                        } else {
                            spinner.warn(chalk.yellow('⚠️  Connected but received empty response'));
                        }
                    } catch (error) {
                        spinner.fail(chalk.red('❌ Connection failed'));
                        const err = error as Error;
                        
                        console.log(chalk.red('\n❌ Error Details:'));
                        console.log(chalk.white(`  ${err.message}\n`));
                        
                        // Provide helpful error messages
                        if (err.message?.includes('401') || err.message?.toLowerCase().includes('unauthorized')) {
                            console.log(chalk.yellow('💡 This usually means:'));
                            console.log(chalk.white('  - Your API key is invalid or expired'));
                            console.log(chalk.white('  - Check your API key: acp config get ACP_API_KEY'));
                            console.log(chalk.white('  - Update it: acp config set ACP_API_KEY=your-key\n'));
                        } else if (err.message?.includes('model') || err.message?.toLowerCase().includes('not found')) {
                            console.log(chalk.yellow('💡 This usually means:'));
                            console.log(chalk.white(`  - The model "${config.ACP_MODEL}" is not available`));
                            console.log(chalk.white('  - Check available models for your provider'));
                            console.log(chalk.white('  - Update model: acp config set ACP_MODEL=model-name\n'));
                        } else if (err.message?.includes('network') || err.message?.toLowerCase().includes('timeout')) {
                            console.log(chalk.yellow('💡 This usually means:'));
                            console.log(chalk.white('  - Network connectivity issue'));
                            console.log(chalk.white('  - Check your internet connection'));
                            if (config.ACP_API_URL) {
                                console.log(chalk.white(`  - Verify API URL: ${config.ACP_API_URL}\n`));
                            }
                        } else {
                            console.log(chalk.yellow('💡 Troubleshooting:'));
                            console.log(chalk.white('  - Check your configuration: acp config list'));
                            console.log(chalk.white('  - Verify API key and model settings\n'));
                        }
                    }
                })();
                break;
            }
            
            default:
                console.error(chalk.red(`❌ Unknown subcommand: ${subcommand}`));
                console.log(chalk.yellow('Available subcommands: set, get, describe, list, test'));
        }
    }
);
