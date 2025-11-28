import { execa } from 'execa';

/**
 * Common patterns for files that should be excluded from commit message generation
 */
const DEFAULT_EXCLUDE_PATTERNS = [
    /node_modules/,
    /\.git\//,
    /dist\//,
    /build\//,
    /\.next\//,
    /\.nuxt\//,
    /\.cache\//,
    /coverage\//,
    /\.nyc_output\//,
    /\.vscode\//,
    /\.idea\//,
    /\.DS_Store$/,
    /Thumbs\.db$/,
    /\.log$/,
    /\.lock$/,
    /package-lock\.json$/,
    /yarn\.lock$/,
    /pnpm-lock\.yaml$/
];

/**
 * Check if a file path matches any exclude pattern
 */
const shouldExcludeFile = (filePath: string, excludePatterns: RegExp[]): boolean => {
    return excludePatterns.some(pattern => pattern.test(filePath));
};

/**
 * Get list of binary files from staged changes
 */
const getBinaryFiles = async (): Promise<Set<string>> => {
    try {
        const { stdout } = await execa('git', ['diff', '--cached', '--numstat']);
        const binaryFiles = new Set<string>();
        
        const lines = stdout.split('\n').filter(line => line.trim());
        for (const line of lines) {
            // Format: additions deletions filename
            // Binary files show "-" for additions/deletions
            const parts = line.split(/\s+/);
            if (parts.length >= 3 && (parts[0] === '-' || parts[1] === '-')) {
                const filename = parts.slice(2).join(' ');
                binaryFiles.add(filename);
            }
        }
        
        return binaryFiles;
    } catch (error) {
        // If command fails, return empty set
        return new Set();
    }
};

/**
 * Extract file paths from a git diff (optimized version)
 */
const extractFilePaths = (diff: string): string[] => {
    const filePaths: string[] = [];
    const separator = 'diff --git ';
    const chunks = diff.split(separator);
    
    // Process chunks starting from index 1 (skip first empty chunk)
    for (let i = 1; i < chunks.length; i++) {
        const chunk = chunks[i];
        // Find first newline to get the header line
        const firstNewline = chunk.indexOf('\n');
        if (firstNewline > 0) {
            const headerLine = separator + chunk.substring(0, firstNewline);
            const match = headerLine.match(/^diff --git a\/(.+?) b\/(.+?)$/);
            if (match) {
                // Use the 'b' path (new file path)
                filePaths.push(match[2]);
            }
        }
    }
    
    return filePaths;
};

/**
 * Filter out excluded file diffs from a git diff string (optimized)
 */
const filterDiffByFiles = (diff: string, excludedFiles: Set<string>, filePathsMap: Map<number, string[]>): string => {
    if (excludedFiles.size === 0) {
        return diff;
    }
    
    const separator = 'diff --git ';
    const diffChunks = diff.split(separator);
    
    if (diffChunks.length <= 1) {
        return diff;
    }
    
    // Keep the first chunk (usually empty or header) and filter the rest
    const filteredChunks = [diffChunks[0]];
    
    for (let i = 1; i < diffChunks.length; i++) {
        const chunk = diffChunks[i];
        // Use pre-extracted file paths if available
        const filePaths = filePathsMap.get(i) || [];
        
        // Check if any file in this chunk should be excluded
        const shouldExclude = filePaths.some(path => excludedFiles.has(path));
        
        if (!shouldExclude) {
            filteredChunks.push(chunk);
        }
    }
    
    return filteredChunks.join(separator);
};

/**
 * Filter a git diff to exclude binary files and common irrelevant files
 */
export const filterDiff = async (
    diff: string,
    excludePatterns: RegExp[] = DEFAULT_EXCLUDE_PATTERNS
): Promise<string> => {
    if (!diff || diff.trim().length === 0) {
        return diff;
    }
    
    const separator = 'diff --git ';
    const diffChunks = diff.split(separator);
    
    // Quick check: if no file diffs, return as-is
    if (diffChunks.length <= 1) {
        return diff;
    }
    
    // Extract file paths and build map in one pass
    const filePaths: string[] = [];
    const filePathsMap = new Map<number, string[]>();
    
    for (let i = 1; i < diffChunks.length; i++) {
        const chunk = diffChunks[i];
        const firstNewline = chunk.indexOf('\n');
        if (firstNewline > 0) {
            const headerLine = separator + chunk.substring(0, firstNewline);
            const match = headerLine.match(/^diff --git a\/(.+?) b\/(.+?)$/);
            if (match) {
                const filePath = match[2];
                filePaths.push(filePath);
                filePathsMap.set(i, [filePath]);
            }
        }
    }
    
    // Quick check: if no file paths found, return as-is
    if (filePaths.length === 0) {
        return diff;
    }
    
    // Check exclude patterns first (fast, no async)
    const excludedFiles = new Set<string>();
    for (const filePath of filePaths) {
        if (shouldExcludeFile(filePath, excludePatterns)) {
            excludedFiles.add(filePath);
        }
    }
    
    // Only check binary files if we haven't excluded everything already
    // and if the diff is large enough to warrant the git command
    if (excludedFiles.size < filePaths.length && diff.length > 5000) {
        const binaryFiles = await getBinaryFiles();
        for (const filePath of filePaths) {
            if (binaryFiles.has(filePath)) {
                excludedFiles.add(filePath);
            }
        }
    }
    
    // Filter the diff using pre-extracted paths
    return filterDiffByFiles(diff, excludedFiles, filePathsMap);
};

