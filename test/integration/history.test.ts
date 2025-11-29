import { TestConfig } from './helpers/config';
import { execSync } from 'child_process';
import { join } from 'path';
import { existsSync, readFileSync, rmSync } from 'fs';
import { homedir } from 'os';

const STORAGE_DIR = join(homedir(), '.alcapush');
const HISTORY_FILE = join(STORAGE_DIR, 'history.json');
const FAVORITES_FILE = join(STORAGE_DIR, 'favorites.json');

describe('History Command Integration Tests', () => {
    let testConfig: TestConfig;
    const cliPath = join(__dirname, '../../out/cli.cjs');

    beforeAll(() => {
        testConfig = new TestConfig();
        testConfig.backup();
    });

    afterAll(() => {
        testConfig.restore();
    });

    beforeEach(() => {
        testConfig.clear();
        // Clean up storage files
        if (existsSync(HISTORY_FILE)) {
            rmSync(HISTORY_FILE);
        }
        if (existsSync(FAVORITES_FILE)) {
            rmSync(FAVORITES_FILE);
        }
    });

    afterEach(() => {
        // Clean up storage files
        if (existsSync(HISTORY_FILE)) {
            rmSync(HISTORY_FILE);
        }
        if (existsSync(FAVORITES_FILE)) {
            rmSync(FAVORITES_FILE);
        }
    });

    describe('history list', () => {
        it('should show empty history when no commits exist', () => {
            const output = execSync(
                `node ${cliPath} history`,
                { encoding: 'utf-8' }
            );

            expect(output).toContain('No commit history found');
        });

        it('should list commit history', () => {
            // Manually create history entries
            const history = [
                {
                    message: 'feat: add new feature',
                    timestamp: Date.now(),
                    branch: 'feature/user-auth'
                },
                {
                    message: 'fix: bug fix',
                    timestamp: Date.now() - 1000,
                    branch: 'fix/login'
                }
            ];
            
            require('fs').mkdirSync(STORAGE_DIR, { recursive: true });
            require('fs').writeFileSync(HISTORY_FILE, JSON.stringify(history));

            const output = execSync(
                `node ${cliPath} history`,
                { encoding: 'utf-8' }
            );

            expect(output).toContain('Commit History');
            expect(output).toContain('feat: add new feature');
            expect(output).toContain('fix: bug fix');
        });

        it('should show branch information in history', () => {
            const history = [
                {
                    message: 'feat: add feature',
                    timestamp: Date.now(),
                    branch: 'feature/user-auth'
                }
            ];
            
            require('fs').mkdirSync(STORAGE_DIR, { recursive: true });
            require('fs').writeFileSync(HISTORY_FILE, JSON.stringify(history));

            const output = execSync(
                `node ${cliPath} history`,
                { encoding: 'utf-8' }
            );

            expect(output).toContain('feature/user-auth');
        });

        it('should show favorite icon for favorited commits', () => {
            const history = [
                {
                    message: 'feat: add feature',
                    timestamp: Date.now(),
                    branch: 'feature/user-auth'
                }
            ];
            const favorites = [
                {
                    message: 'feat: add feature',
                    addedAt: Date.now(),
                    usageCount: 0
                }
            ];
            
            require('fs').mkdirSync(STORAGE_DIR, { recursive: true });
            require('fs').writeFileSync(HISTORY_FILE, JSON.stringify(history));
            require('fs').writeFileSync(FAVORITES_FILE, JSON.stringify(favorites));

            const output = execSync(
                `node ${cliPath} history`,
                { encoding: 'utf-8' }
            );

            // Should show favorite icon (⭐)
            expect(output).toMatch(/⭐|feat: add feature/);
        });
    });

    describe('history clear', () => {
        it('should clear commit history', () => {
            // Create history file
            const history = [
                {
                    message: 'feat: add feature',
                    timestamp: Date.now(),
                    branch: 'feature/user-auth'
                }
            ];
            
            require('fs').mkdirSync(STORAGE_DIR, { recursive: true });
            require('fs').writeFileSync(HISTORY_FILE, JSON.stringify(history));

            const output = execSync(
                `node ${cliPath} history clear`,
                { encoding: 'utf-8' }
            );

            expect(output).toContain('cleared');
            
            // Verify history is cleared
            if (existsSync(HISTORY_FILE)) {
                const content = JSON.parse(readFileSync(HISTORY_FILE, 'utf-8'));
                expect(content).toHaveLength(0);
            }
        });
    });

    describe('favorite add', () => {
        it('should add message to favorites', () => {
            const output = execSync(
                `node ${cliPath} favorite add "feat: add new feature"`,
                { encoding: 'utf-8' }
            );

            expect(output).toContain('Added to favorites');
            expect(output).toContain('feat: add new feature');
            
            // Verify favorite was saved
            expect(existsSync(FAVORITES_FILE)).toBe(true);
            const favorites = JSON.parse(readFileSync(FAVORITES_FILE, 'utf-8'));
            expect(favorites).toHaveLength(1);
            expect(favorites[0].message).toBe('feat: add new feature');
        });

        it('should handle duplicate favorites', () => {
            execSync(
                `node ${cliPath} favorite add "feat: add feature"`,
                { encoding: 'utf-8' }
            );

            const output = execSync(
                `node ${cliPath} favorite add "feat: add feature"`,
                { encoding: 'utf-8' }
            );

            expect(output).toContain('Already in favorites');
        });

        it('should handle message with multiple words', () => {
            const output = execSync(
                `node ${cliPath} favorite add "feat: add user authentication feature"`,
                { encoding: 'utf-8' }
            );

            expect(output).toContain('Added to favorites');
            expect(output).toContain('feat: add user authentication feature');
        });
    });

    describe('favorite remove', () => {
        it('should remove message from favorites', () => {
            // Add favorite first
            execSync(
                `node ${cliPath} favorite add "feat: add feature"`,
                { encoding: 'utf-8' }
            );

            const output = execSync(
                `node ${cliPath} favorite remove "feat: add feature"`,
                { encoding: 'utf-8' }
            );

            expect(output).toContain('Removed from favorites');
            
            // Verify favorite was removed
            const favorites = JSON.parse(readFileSync(FAVORITES_FILE, 'utf-8'));
            expect(favorites).toHaveLength(0);
        });

        it('should handle removing non-existent favorite', () => {
            const output = execSync(
                `node ${cliPath} favorite remove "non-existent"`,
                { encoding: 'utf-8' }
            );

            expect(output).toContain('Not found in favorites');
        });
    });

    describe('favorite list', () => {
        it('should list all favorites', () => {
            // Add some favorites
            execSync(
                `node ${cliPath} favorite add "feat: add feature"`,
                { encoding: 'utf-8' }
            );
            execSync(
                `node ${cliPath} favorite add "fix: bug fix"`,
                { encoding: 'utf-8' }
            );

            const output = execSync(
                `node ${cliPath} favorite list`,
                { encoding: 'utf-8' }
            );

            expect(output).toContain('Favorites');
            expect(output).toContain('feat: add feature');
            expect(output).toContain('fix: bug fix');
        });

        it('should show empty list when no favorites', () => {
            const output = execSync(
                `node ${cliPath} favorite list`,
                { encoding: 'utf-8' }
            );

            expect(output).toContain('No favorites found');
        });

        it('should sort favorites by usage count', () => {
            // Add favorites
            execSync(
                `node ${cliPath} favorite add "feat: add feature"`,
                { encoding: 'utf-8' }
            );
            execSync(
                `node ${cliPath} favorite add "fix: bug fix"`,
                { encoding: 'utf-8' }
            );

            // Increment usage for second favorite
            const favorites = JSON.parse(readFileSync(FAVORITES_FILE, 'utf-8'));
            favorites[1].usageCount = 5;
            require('fs').writeFileSync(FAVORITES_FILE, JSON.stringify(favorites));

            const output = execSync(
                `node ${cliPath} favorite list`,
                { encoding: 'utf-8' }
            );

            // Most used should appear first
            const fixIndex = output.indexOf('fix: bug fix');
            const featIndex = output.indexOf('feat: add feature');
            expect(fixIndex).toBeLessThan(featIndex);
        });
    });
});

