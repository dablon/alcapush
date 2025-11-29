import { existsSync, readFileSync, rmSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import {
    saveCommitToHistory,
    getCommitHistory,
    clearCommitHistory,
    addFavorite,
    removeFavorite,
    getFavorites,
    isFavorite,
    incrementFavoriteUsage
} from '../../src/utils/storage';

const STORAGE_DIR = join(homedir(), '.alcapush');
const HISTORY_FILE = join(STORAGE_DIR, 'history.json');
const FAVORITES_FILE = join(STORAGE_DIR, 'favorites.json');

describe('Storage Unit Tests', () => {
    beforeEach(() => {
        // Clean up storage files before each test
        if (existsSync(HISTORY_FILE)) {
            rmSync(HISTORY_FILE);
        }
        if (existsSync(FAVORITES_FILE)) {
            rmSync(FAVORITES_FILE);
        }
    });

    afterEach(() => {
        // Clean up after each test
        if (existsSync(HISTORY_FILE)) {
            rmSync(HISTORY_FILE);
        }
        if (existsSync(FAVORITES_FILE)) {
            rmSync(FAVORITES_FILE);
        }
    });

    describe('Commit History', () => {
        it('should save commit to history', () => {
            saveCommitToHistory('feat: add new feature');
            
            expect(existsSync(HISTORY_FILE)).toBe(true);
            const history = JSON.parse(readFileSync(HISTORY_FILE, 'utf-8'));
            expect(history).toHaveLength(1);
            expect(history[0].message).toBe('feat: add new feature');
            expect(history[0].timestamp).toBeDefined();
        });

        it('should save commit with branch information', () => {
            saveCommitToHistory('fix: bug fix', 'feature/user-auth');
            
            const history = JSON.parse(readFileSync(HISTORY_FILE, 'utf-8'));
            expect(history[0].branch).toBe('feature/user-auth');
        });

        it('should maintain history order (newest first)', async () => {
            saveCommitToHistory('first commit');
            // Small delay to ensure different timestamps
            await new Promise(resolve => setTimeout(resolve, 10));
            saveCommitToHistory('second commit');
            
            const history = getCommitHistory();
            expect(history[0].message).toBe('second commit');
            expect(history[1].message).toBe('first commit');
        });

        it('should limit history to 100 entries', () => {
            // Clear history first to ensure clean state
            clearCommitHistory();
            
            for (let i = 0; i < 150; i++) {
                saveCommitToHistory(`commit ${i}`);
            }
            
            const history = getCommitHistory(100);
            expect(history.length).toBe(100);
            expect(history[0].message).toBe('commit 149');
            expect(history[99].message).toBe('commit 50');
        });

        it('should get commit history with limit', () => {
            for (let i = 0; i < 10; i++) {
                saveCommitToHistory(`commit ${i}`);
            }
            
            const history = getCommitHistory(5);
            expect(history.length).toBe(5);
        });

        it('should clear commit history', () => {
            saveCommitToHistory('test commit');
            clearCommitHistory();
            
            const history = getCommitHistory();
            expect(history).toHaveLength(0);
        });

        it('should trim commit message whitespace', () => {
            saveCommitToHistory('  feat: add feature  ');
            
            const history = getCommitHistory();
            expect(history[0].message).toBe('feat: add feature');
        });
    });

    describe('Favorites', () => {
        it('should add favorite', () => {
            const result = addFavorite('feat: add feature');
            
            expect(result).toBe(true);
            expect(existsSync(FAVORITES_FILE)).toBe(true);
            const favorites = JSON.parse(readFileSync(FAVORITES_FILE, 'utf-8'));
            expect(favorites).toHaveLength(1);
            expect(favorites[0].message).toBe('feat: add feature');
            expect(favorites[0].addedAt).toBeDefined();
            expect(favorites[0].usageCount).toBe(0);
        });

        it('should not add duplicate favorite', () => {
            addFavorite('feat: add feature');
            const result = addFavorite('feat: add feature');
            
            expect(result).toBe(false);
            const favorites = getFavorites();
            expect(favorites).toHaveLength(1);
        });

        it('should remove favorite', () => {
            addFavorite('feat: add feature');
            const result = removeFavorite('feat: add feature');
            
            expect(result).toBe(true);
            const favorites = getFavorites();
            expect(favorites).toHaveLength(0);
        });

        it('should return false when removing non-existent favorite', () => {
            const result = removeFavorite('non-existent');
            
            expect(result).toBe(false);
        });

        it('should get all favorites', () => {
            addFavorite('feat: add feature');
            addFavorite('fix: bug fix');
            
            const favorites = getFavorites();
            expect(favorites).toHaveLength(2);
        });

        it('should check if message is favorite', () => {
            addFavorite('feat: add feature');
            
            expect(isFavorite('feat: add feature')).toBe(true);
            expect(isFavorite('fix: bug fix')).toBe(false);
        });

        it('should increment favorite usage count', () => {
            addFavorite('feat: add feature');
            incrementFavoriteUsage('feat: add feature');
            incrementFavoriteUsage('feat: add feature');
            
            const favorites = getFavorites();
            expect(favorites[0].usageCount).toBe(2);
        });

        it('should handle incrementing usage for non-existent favorite gracefully', () => {
            // Should not throw error
            expect(() => {
                incrementFavoriteUsage('non-existent');
            }).not.toThrow();
        });

        it('should trim favorite message whitespace', () => {
            addFavorite('  feat: add feature  ');
            
            const favorites = getFavorites();
            expect(favorites[0].message).toBe('feat: add feature');
            expect(isFavorite('feat: add feature')).toBe(true);
        });
    });
});

