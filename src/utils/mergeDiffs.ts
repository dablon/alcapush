import { tokenCount } from './tokenCount';

/**
 * Merge multiple diffs into chunks that fit within maxTokenLength (token-based)
 * Optimized to reduce token counting overhead
 */
export const mergeDiffs = (
    diffs: string[],
    maxTokenLength: number
): string[] => {
    if (diffs.length === 0) {
        return [];
    }
    
    if (diffs.length === 1) {
        return diffs;
    }
    
    const merged: string[] = [];
    let current = '';
    let currentTokens = 0;

    for (const diff of diffs) {
        // Use quick approximation for small diffs, full count for larger ones
        const diffTokens = diff.length < 1000 
            ? Math.ceil(diff.length / 4) // Quick approximation
            : tokenCount(diff);
        
        if (currentTokens + diffTokens <= maxTokenLength) {
            current += (current ? '\n' : '') + diff;
            currentTokens += diffTokens;
        } else {
            if (current) {
                merged.push(current);
            }
            current = diff;
            currentTokens = diffTokens;
        }
    }

    if (current) {
        merged.push(current);
    }
    
    return merged;
};


