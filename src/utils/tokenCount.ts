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

export const tokenCount = (text: string): number => {
    const enc = getEncoder();
    if (enc) {
        try {
            return enc.encode(text).length;
        } catch (error) {
            // Fallback to approximation
        }
    }

    // Rough approximation: ~4 characters per token
    return Math.ceil(text.length / 4);
};

export const freeEncoder = () => {
    if (encoder) {
        encoder.free();
        encoder = null;
    }
};
