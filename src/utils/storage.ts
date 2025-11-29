import { homedir } from 'os';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const STORAGE_DIR = join(homedir(), '.alcapush');
const HISTORY_FILE = join(STORAGE_DIR, 'history.json');
const FAVORITES_FILE = join(STORAGE_DIR, 'favorites.json');

export interface CommitHistoryEntry {
    message: string;
    timestamp: number;
    branch?: string;
}

export interface FavoriteEntry {
    message: string;
    addedAt: number;
    usageCount: number;
}

const ensureStorageDir = (): void => {
    if (!existsSync(STORAGE_DIR)) {
        mkdirSync(STORAGE_DIR, { recursive: true });
    }
};

const readHistory = (): CommitHistoryEntry[] => {
    ensureStorageDir();
    if (!existsSync(HISTORY_FILE)) {
        return [];
    }
    try {
        const content = readFileSync(HISTORY_FILE, 'utf-8');
        return JSON.parse(content);
    } catch (error) {
        return [];
    }
};

const writeHistory = (history: CommitHistoryEntry[]): void => {
    ensureStorageDir();
    writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2), 'utf-8');
};

const readFavorites = (): FavoriteEntry[] => {
    ensureStorageDir();
    if (!existsSync(FAVORITES_FILE)) {
        return [];
    }
    try {
        const content = readFileSync(FAVORITES_FILE, 'utf-8');
        return JSON.parse(content);
    } catch (error) {
        return [];
    }
};

const writeFavorites = (favorites: FavoriteEntry[]): void => {
    ensureStorageDir();
    writeFileSync(FAVORITES_FILE, JSON.stringify(favorites, null, 2), 'utf-8');
};

/**
 * Save a commit message to history
 */
export const saveCommitToHistory = (message: string, branch?: string): void => {
    const history = readHistory();
    const entry: CommitHistoryEntry = {
        message: message.trim(),
        timestamp: Date.now(),
        branch
    };
    
    // Add to beginning of history
    history.unshift(entry);
    
    // Keep only last 100 entries
    const MAX_HISTORY = 100;
    if (history.length > MAX_HISTORY) {
        history.splice(MAX_HISTORY);
    }
    
    writeHistory(history);
};

/**
 * Get commit history
 */
export const getCommitHistory = (limit: number = 50): CommitHistoryEntry[] => {
    const history = readHistory();
    return history.slice(0, limit);
};

/**
 * Clear commit history
 */
export const clearCommitHistory = (): void => {
    writeHistory([]);
};

/**
 * Add a commit message to favorites
 */
export const addFavorite = (message: string): boolean => {
    const favorites = readFavorites();
    const trimmedMessage = message.trim();
    
    // Check if already exists
    const existingIndex = favorites.findIndex(f => f.message === trimmedMessage);
    if (existingIndex >= 0) {
        return false; // Already exists
    }
    
    favorites.push({
        message: trimmedMessage,
        addedAt: Date.now(),
        usageCount: 0
    });
    
    writeFavorites(favorites);
    return true;
};

/**
 * Remove a commit message from favorites
 */
export const removeFavorite = (message: string): boolean => {
    const favorites = readFavorites();
    const trimmedMessage = message.trim();
    
    const index = favorites.findIndex(f => f.message === trimmedMessage);
    if (index < 0) {
        return false; // Not found
    }
    
    favorites.splice(index, 1);
    writeFavorites(favorites);
    return true;
};

/**
 * Get all favorites
 */
export const getFavorites = (): FavoriteEntry[] => {
    return readFavorites();
};

/**
 * Increment usage count for a favorite
 */
export const incrementFavoriteUsage = (message: string): void => {
    const favorites = readFavorites();
    const trimmedMessage = message.trim();
    
    const favorite = favorites.find(f => f.message === trimmedMessage);
    if (favorite) {
        favorite.usageCount++;
        writeFavorites(favorites);
    }
};

/**
 * Check if a message is in favorites
 */
export const isFavorite = (message: string): boolean => {
    const favorites = readFavorites();
    return favorites.some(f => f.message === message.trim());
};

