import { command } from 'cleye';
import chalk from 'chalk';
import {
    getCommitHistory,
    clearCommitHistory,
    addFavorite,
    removeFavorite,
    getFavorites,
    isFavorite
} from '../utils/storage';

export const historyCommand = command(
    {
        name: 'history',
        parameters: ['[subcommand]', '[args...]']
    },
    (argv) => {
        const subcommand = argv._.subcommand || 'list';
        const args = argv._.args || [];
        
        switch (subcommand) {
            case 'list':
            case 'ls': {
                const limit = args[0] ? parseInt(args[0], 10) : 50;
                const history = getCommitHistory(limit);
                
                if (history.length === 0) {
                    console.log(chalk.yellow('No commit history found.'));
                    return;
                }
                
                console.log(chalk.cyan(`\n📜 Commit History (last ${history.length} commits):\n`));
                
                history.forEach((entry, index) => {
                    const date = new Date(entry.timestamp);
                    const dateStr = date.toLocaleString();
                    const branchInfo = entry.branch ? chalk.gray(` [${entry.branch}]`) : '';
                    const favoriteIcon = isFavorite(entry.message) ? chalk.yellow(' ⭐') : '';
                    
                    console.log(
                        chalk.gray(`${(index + 1).toString().padStart(3)}. `) +
                        chalk.white(entry.message) +
                        branchInfo +
                        favoriteIcon
                    );
                    console.log(chalk.gray(`     ${dateStr}\n`));
                });
                break;
            }
            
            case 'clear': {
                clearCommitHistory();
                console.log(chalk.green('✅ Commit history cleared.'));
                break;
            }
            
            default:
                console.error(chalk.red(`❌ Unknown subcommand: ${subcommand}`));
                console.log(chalk.yellow('Available subcommands: list, clear'));
        }
    }
);

export const favoriteCommand = command(
    {
        name: 'favorite',
        parameters: ['<subcommand>', '[args...]']
    },
    (argv) => {
        const subcommand = argv._.subcommand;
        const args = argv._.args || [];
        
        if (!subcommand) {
            console.log(chalk.yellow('Please specify a subcommand: add, remove, list'));
            return;
        }
        
        switch (subcommand) {
            case 'add': {
                const message = args.join(' ').trim();
                if (!message) {
                    console.error(chalk.red('❌ Please provide a commit message to add to favorites'));
                    return;
                }
                
                if (addFavorite(message)) {
                    console.log(chalk.green(`✅ Added to favorites: ${message}`));
                } else {
                    console.log(chalk.yellow(`⚠️  Already in favorites: ${message}`));
                }
                break;
            }
            
            case 'remove':
            case 'rm': {
                const message = args.join(' ').trim();
                if (!message) {
                    console.error(chalk.red('❌ Please provide a commit message to remove from favorites'));
                    return;
                }
                
                if (removeFavorite(message)) {
                    console.log(chalk.green(`✅ Removed from favorites: ${message}`));
                } else {
                    console.log(chalk.yellow(`⚠️  Not found in favorites: ${message}`));
                }
                break;
            }
            
            case 'list':
            case 'ls': {
                const favorites = getFavorites();
                
                if (favorites.length === 0) {
                    console.log(chalk.yellow('No favorites found.'));
                    return;
                }
                
                // Sort by usage count (descending), then by added date (descending)
                const sorted = [...favorites].sort((a, b) => {
                    if (b.usageCount !== a.usageCount) {
                        return b.usageCount - a.usageCount;
                    }
                    return b.addedAt - a.addedAt;
                });
                
                console.log(chalk.cyan(`\n⭐ Favorites (${sorted.length}):\n`));
                
                sorted.forEach((favorite, index) => {
                    const date = new Date(favorite.addedAt);
                    const dateStr = date.toLocaleDateString();
                    const usageInfo = favorite.usageCount > 0 
                        ? chalk.gray(` (used ${favorite.usageCount}x)`)
                        : '';
                    
                    console.log(
                        chalk.gray(`${(index + 1).toString().padStart(3)}. `) +
                        chalk.white(favorite.message) +
                        usageInfo
                    );
                    console.log(chalk.gray(`     Added: ${dateStr}\n`));
                });
                break;
            }
            
            default:
                console.error(chalk.red(`❌ Unknown subcommand: ${subcommand}`));
                console.log(chalk.yellow('Available subcommands: add, remove, list'));
        }
    }
);

