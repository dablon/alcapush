import { encoding_for_model, TiktokenModel } from '@dqbd/tiktoken';

let encoder: ReturnType<typeof encoding_for_model> | null = null;

const getEncoder = () => {
    if (!encoder) {
        try {
            // Try to use gpt-4 encoding as a fallback for gpt-5-nano
            encoder = encoding_for_model('gpt-4' as TiktokenModel);
        } catch (error) {
            console.warn('Failed to load tiktoken encoder, using approximation');
        }
    }
    return encoder;
};

// Cache for token counts to avoid recomputation
const tokenCountCache = new Map<string, number>();
const CACHE_SIZE_LIMIT = 100;

export const tokenCount = (text: string): number => {
    // For very large texts, use approximation to avoid expensive encoding
    if (text.length > 50000) {
        return Math.ceil(text.length / 4);
    }
    
    // Check cache first
    if (tokenCountCache.has(text)) {
        return tokenCountCache.get(text)!;
    }
    
    const enc = getEncoder();
    let count: number;
    
    if (enc) {
        try {
            count = enc.encode(text).length;
        } catch (error) {
            // Fallback to approximation
            count = Math.ceil(text.length / 4);
        }
    } else {
        // Rough approximation: ~4 characters per token
        count = Math.ceil(text.length / 4);
    }
    
    // Cache the result (with size limit to prevent memory issues)
    if (tokenCountCache.size < CACHE_SIZE_LIMIT) {
        tokenCountCache.set(text, count);
    }
    
    return count;
};

export const freeEncoder = () => {
    if (encoder) {
        encoder.free();
        encoder = null;
    }
};
