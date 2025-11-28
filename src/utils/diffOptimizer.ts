/**
 * Maximum number of lines to keep per file diff before truncating
 */
const MAX_LINES_PER_FILE = 500;

/**
 * Maximum number of context lines to show before summarizing
 */
const MAX_CONTEXT_LINES = 50;

/**
 * Truncate a single file diff if it's too large
 */
const truncateFileDiff = (fileDiff: string): string => {
    const lines = fileDiff.split('\n');
    
    if (lines.length <= MAX_LINES_PER_FILE) {
        return fileDiff;
    }
    
    // Keep the header and first MAX_LINES_PER_FILE lines
    const headerEndIndex = lines.findIndex(line => 
        line.startsWith('@@') || line.startsWith('---') || line.startsWith('+++')
    );
    
    const headerLines = headerEndIndex >= 0 ? lines.slice(0, headerEndIndex + 1) : [];
    const contentLines = lines.slice(headerEndIndex + 1);
    
    if (contentLines.length <= MAX_LINES_PER_FILE) {
        return fileDiff;
    }
    
    const keptLines = contentLines.slice(0, MAX_LINES_PER_FILE);
    const removedCount = contentLines.length - MAX_LINES_PER_FILE;
    
    const truncated = [
        ...headerLines,
        ...keptLines,
        `\n... (${removedCount} more lines truncated to reduce token usage) ...`
    ].join('\n');
    
    return truncated;
};

/**
 * Summarize excessive context lines in a diff
 */
const summarizeContextLines = (diff: string): string => {
    const lines = diff.split('\n');
    const result: string[] = [];
    let contextLines: string[] = [];
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const isContext = line.startsWith(' ') && !line.startsWith('@@');
        const isChange = line.startsWith('+') || line.startsWith('-') || line.startsWith('@@');
        
        if (isContext) {
            contextLines.push(line);
            
            // If we've accumulated too many context lines, keep only first and last few
            if (contextLines.length > MAX_CONTEXT_LINES) {
                // Don't add yet, wait for a change line to summarize
            }
        } else {
            // When we hit a change, process accumulated context lines
            if (contextLines.length > MAX_CONTEXT_LINES) {
                // Keep first few and last few context lines, summarize the middle
                const keepCount = Math.floor(MAX_CONTEXT_LINES / 2);
                result.push(...contextLines.slice(0, keepCount));
                result.push(`... (${contextLines.length - keepCount * 2} context lines) ...`);
                result.push(...contextLines.slice(-keepCount));
            } else {
                result.push(...contextLines);
            }
            contextLines = [];
            result.push(line);
        }
    }
    
    // Handle any remaining context lines at the end
    if (contextLines.length > 0) {
        if (contextLines.length > MAX_CONTEXT_LINES) {
            const keepCount = Math.floor(MAX_CONTEXT_LINES / 2);
            result.push(...contextLines.slice(0, keepCount));
            result.push(`... (${contextLines.length - keepCount * 2} context lines) ...`);
            result.push(...contextLines.slice(-keepCount));
        } else {
            result.push(...contextLines);
        }
    }
    
    return result.join('\n');
};

/**
 * Remove binary file indicators from diff
 */
const removeBinaryIndicators = (diff: string): string => {
    // Remove lines like "Binary files a/file and b/file differ"
    return diff.split('\n')
        .filter(line => {
            // Only remove lines that are specifically binary file indicators
            const trimmed = line.trim();
            return !(trimmed.startsWith('Binary files') && trimmed.endsWith('differ'));
        })
        .join('\n');
};

/**
 * Compress whitespace-only changes
 */
const compressWhitespaceChanges = (diff: string): string => {
    const lines = diff.split('\n');
    const result: string[] = [];
    let whitespaceOnlyBlock: string[] = [];
    
    for (const line of lines) {
        const isWhitespaceOnly = (line.startsWith('+') || line.startsWith('-')) &&
            line.slice(1).trim().length === 0;
        
        if (isWhitespaceOnly) {
            whitespaceOnlyBlock.push(line);
        } else {
            if (whitespaceOnlyBlock.length > 5) {
                // Compress large whitespace-only blocks
                result.push(`... (${whitespaceOnlyBlock.length} whitespace-only lines) ...`);
            } else {
                result.push(...whitespaceOnlyBlock);
            }
            whitespaceOnlyBlock = [];
            result.push(line);
        }
    }
    
    if (whitespaceOnlyBlock.length > 5) {
        result.push(`... (${whitespaceOnlyBlock.length} whitespace-only lines) ...`);
    } else {
        result.push(...whitespaceOnlyBlock);
    }
    
    return result.join('\n');
};

/**
 * Optimize a git diff by truncating large files and summarizing context
 * Only processes if diff is large enough to warrant optimization
 */
export const optimizeDiff = (diff: string): string => {
    if (!diff || diff.trim().length === 0) {
        return diff;
    }
    
    // Skip optimization for very small diffs
    if (diff.length < 5000) {
        return diff;
    }
    
    // Split by file diffs
    const separator = 'diff --git ';
    const chunks = diff.split(separator);
    
    if (chunks.length <= 1) {
        // Single chunk or no separator, optimize as-is
        let optimized = removeBinaryIndicators(diff);
        optimized = truncateFileDiff(optimized);
        optimized = summarizeContextLines(optimized);
        optimized = compressWhitespaceChanges(optimized);
        return optimized;
    }
    
    // Process each file diff separately
    const optimizedChunks: string[] = [chunks[0]]; // Keep first chunk (usually empty)
    
    for (let i = 1; i < chunks.length; i++) {
        const fileDiff = separator + chunks[i];
        
        // Only optimize large file diffs
        if (fileDiff.length > 2000) {
            let optimized = removeBinaryIndicators(fileDiff);
            optimized = truncateFileDiff(optimized);
            optimized = summarizeContextLines(optimized);
            optimized = compressWhitespaceChanges(optimized);
            
            // Remove the separator we added if the chunk is now empty
            if (optimized.trim() === separator.trim()) {
                continue;
            }
            
            optimizedChunks.push(optimized.replace(separator, ''));
        } else {
            // Small file diff - just remove binary indicators
            const optimized = removeBinaryIndicators(fileDiff);
            if (optimized.trim() !== separator.trim()) {
                optimizedChunks.push(optimized.replace(separator, ''));
            }
        }
    }
    
    return optimizedChunks.join(separator);
};

