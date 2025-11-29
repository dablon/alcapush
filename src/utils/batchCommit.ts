import { tokenCount } from './tokenCount';
import { generateCommitMessageByDiff } from '../generateCommitMessage';
import { BranchContext } from './branchAnalysis';
import { getEngine } from './engine';
import { OpenAI } from 'openai';

export interface FileDiff {
    filePath: string;
    diff: string;
    size: number; // bytes
}

export interface FileGroup {
    id: string;
    name: string; // e.g., "src/utils (5 files)" or "src/cli.ts"
    description?: string; // AI-generated description of why files are grouped
    files: FileDiff[];
    totalSize: number; // bytes
}

export interface CommitGroup extends FileGroup {
    message: string;
    confirmed: boolean;
}

/**
 * Get list of changed files from git (more reliable than parsing diff)
 * Returns empty array if git is not available (e.g., in tests)
 */
const getChangedFileList = async (staged: boolean = true, unstaged: boolean = false): Promise<string[]> => {
    const { execa } = await import('execa');
    const files = new Set<string>();
    
    try {
        if (staged) {
            const { stdout } = await execa('git', ['diff', '--cached', '--name-only']);
            stdout.split('\n').forEach(f => {
                const trimmed = f.trim();
                if (trimmed) files.add(trimmed);
            });
        }
        if (unstaged) {
            const { stdout } = await execa('git', ['diff', '--name-only']);
            stdout.split('\n').forEach(f => {
                const trimmed = f.trim();
                if (trimmed) files.add(trimmed);
            });
        }
    } catch {
        // If git command fails (e.g., not in git repo, or in tests), return empty array
        // This allows the function to still parse diffs even without git validation
        return [];
    }
    
    return Array.from(files);
};

/**
 * Split a git diff into file-based chunks
 * If the same file appears multiple times (e.g., staged + unstaged), merge them
 */
export const splitDiffByFiles = async (diff: string, includeUnstaged: boolean = false): Promise<FileDiff[]> => {
    if (!diff || diff.trim().length === 0) {
        return [];
    }

    // Get actual list of changed files from git (more reliable)
    // If git is not available (e.g., in tests), we'll validate paths manually
    const actualFiles = await getChangedFileList(true, includeUnstaged);
    const validFileSet = actualFiles.length > 0 ? new Set(actualFiles) : null;

    const separator = 'diff --git ';
    const chunks = diff.split(separator);
    
    // Skip the first chunk (usually empty or header)
    const fileMap = new Map<string, FileDiff>();
    
    for (let i = 1; i < chunks.length; i++) {
        const chunk = chunks[i];
        const fullDiff = separator + chunk;
        
        // Extract file path from the diff header
        const firstNewline = chunk.indexOf('\n');
        if (firstNewline > 0) {
            const headerLine = separator + chunk.substring(0, firstNewline);
            const match = headerLine.match(/^diff --git a\/(.+?) b\/(.+?)$/);
            if (match) {
                let filePath = match[2]; // Use the 'b' path (new file path)
                
                // Clean up file path
                filePath = filePath.trim();
                
                // Additional validation
                if (filePath.includes('\n') || 
                    filePath.length > 500 ||
                    filePath.length === 0 ||
                    filePath.startsWith('a/') || // Test artifact paths
                    (filePath.includes('${') || filePath.includes('`')) || // Template strings
                    (filePath.includes('content') && filePath.length < 20) || // Test data
                    filePath.match(/^[\d\s]+$/)) { // Only numbers/spaces
                    continue;
                }
                
                // If we have git file list, validate against it
                // Otherwise, rely on path validation above
                if (validFileSet && !validFileSet.has(filePath)) {
                    continue;
                }
                
                // If file already exists (e.g., staged + unstaged), merge diffs
                if (fileMap.has(filePath)) {
                    const existing = fileMap.get(filePath)!;
                    // Combine diffs with a newline separator
                    existing.diff = existing.diff + '\n' + fullDiff;
                    existing.size = existing.diff.length;
                } else {
                    fileMap.set(filePath, {
                        filePath,
                        diff: fullDiff,
                        size: fullDiff.length
                    });
                }
            }
        }
    }
    
    return Array.from(fileMap.values());
};

/**
 * Group files by directory or keep as individual files
 */
export const groupFilesByDirectory = (files: FileDiff[], groupBy: 'file' | 'directory'): FileGroup[] => {
    if (groupBy === 'file') {
        // Each file is its own group
        return files.map((file, index) => ({
            id: `file-${index}`,
            name: file.filePath,
            files: [file],
            totalSize: file.size
        }));
    }
    
    // Group by directory
    const directoryMap = new Map<string, FileDiff[]>();
    
    for (const file of files) {
        const dir = file.filePath.substring(0, file.filePath.lastIndexOf('/') || 0);
        const directory = dir || '.'; // Root directory
        
        if (!directoryMap.has(directory)) {
            directoryMap.set(directory, []);
        }
        directoryMap.get(directory)!.push(file);
    }
    
    // Convert map to FileGroup array
    const groups: FileGroup[] = [];
    let groupIndex = 0;
    
    for (const [directory, dirFiles] of directoryMap.entries()) {
        const totalSize = dirFiles.reduce((sum, file) => sum + file.size, 0);
        const fileCount = dirFiles.length;
        const name = fileCount > 1 
            ? `${directory} (${fileCount} files)`
            : dirFiles[0].filePath;
        
        groups.push({
            id: `dir-${groupIndex++}`,
            name,
            files: dirFiles,
            totalSize
        });
    }
    
    // Sort by directory name for consistency
    groups.sort((a, b) => a.name.localeCompare(b.name));
    
    return groups;
};

/**
 * Combine multiple file diffs into a single diff string
 */
export const combineFileDiffs = (files: FileDiff[]): string => {
    return files.map(file => file.diff).join('\n');
};

/**
 * Generate commit messages for selected groups
 */
export const generateBatchCommits = async (
    groups: FileGroup[],
    fullGitMojiSpec: boolean = false,
    context: string = '',
    branchContext?: BranchContext
): Promise<CommitGroup[]> => {
    const commitGroups: CommitGroup[] = [];
    
    for (const group of groups) {
        const combinedDiff = combineFileDiffs(group.files);
        
        try {
            const message = await generateCommitMessageByDiff(
                combinedDiff,
                fullGitMojiSpec,
                context,
                branchContext
            );
            
            commitGroups.push({
                ...group,
                message: message.trim(),
                confirmed: false
            });
        } catch (error) {
            // If generation fails, skip this group or use a fallback
            const err = error as Error;
            console.warn(`Failed to generate commit message for ${group.name}: ${err.message}`);
            commitGroups.push({
                ...group,
                message: `Update ${group.name}`,
                confirmed: false
            });
        }
    }
    
    return commitGroups;
};

/**
 * Format file size for display
 */
export const formatSize = (bytes: number): string => {
    if (bytes < 1024) {
        return `${bytes} B`;
    } else if (bytes < 1024 * 1024) {
        return `${(bytes / 1024).toFixed(1)} KB`;
    } else {
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }
};

/**
 * Estimate tokens for a diff (quick approximation)
 */
export const estimateTokens = (diff: string): number => {
    // Use quick approximation for display purposes
    return diff.length < 1000 
        ? Math.ceil(diff.length / 4)
        : tokenCount(diff);
};

/**
 * Use AI to suggest logical groupings of files based on their changes
 * @param files - Array of file diffs to group
 * @param branchContext - Optional branch context
 * @param targetCommitCount - Target number of commits (if specified, AI will try to create exactly this many groups)
 */
export const suggestLogicalGroupings = async (
    files: FileDiff[],
    branchContext?: BranchContext,
    targetCommitCount?: number
): Promise<FileGroup[]> => {
    if (files.length === 0) {
        return [];
    }

    // If only one file, return it as a single group
    if (files.length === 1) {
        return [{
            id: 'group-0',
            name: files[0].filePath,
            files: [files[0]],
            totalSize: files[0].size
        }];
    }

    // Create a summary of all files for AI analysis
    const fileSummary = files.map((file, index) => {
        // Extract a preview of changes (first 500 chars)
        const preview = file.diff.substring(0, 500).replace(/\n/g, ' ').substring(0, 200);
        return `${index + 1}. ${file.filePath} (${formatSize(file.size)}) - ${preview}...`;
    }).join('\n');

    const targetCountText = targetCommitCount 
        ? `\n\nCRITICAL: You MUST create exactly ${targetCommitCount} commit groups. Distribute all files across exactly ${targetCommitCount} groups.`
        : '\n\nTry to create meaningful groups (2-5 files per group is ideal, but can vary).';

    const systemPrompt = `You are an expert software developer analyzing git changes to suggest logical commit groupings.

Your task is to analyze the changed files and group them logically for separate commits. Consider:
- Related functionality (files that work together)
- Dependencies (files that depend on each other)
- Feature boundaries (complete features should be in one commit)
- Test files should be grouped with their source files
- Documentation should be grouped with related code
- Configuration files can be separate or grouped with related changes
- Avoid grouping unrelated changes together${targetCountText}

IMPORTANT: Return ONLY a valid JSON array. Each object must have:
- "files": array of file indices (1-based, matching the order in the file list)
- "name": short descriptive name for the group
- "description": brief explanation (1-2 sentences) of why these files are grouped together

Example format:
[
  {
    "files": [1, 2, 5],
    "name": "User authentication feature",
    "description": "Adds login and registration functionality with related utilities"
  },
  {
    "files": [3, 4],
    "name": "Update dependencies",
    "description": "Updates package.json with new dependency versions"
  }
]

Return ONLY the JSON array, no markdown, no code blocks, no explanations.`;

    const userPrompt = `Analyze these ${files.length} changed files and suggest logical commit groupings${targetCommitCount ? ` (create exactly ${targetCommitCount} groups)` : ''}:

${fileSummary}

${branchContext ? `Branch context: ${branchContext.branchName} (${branchContext.branchType})` : ''}

${targetCommitCount ? `IMPORTANT: You must create exactly ${targetCommitCount} groups. All ${files.length} files must be distributed across these ${targetCommitCount} groups.` : ''}

Return a JSON array of suggested groups.`;

    try {
        const engine = getEngine();
        
        const groupingMessages: Array<OpenAI.Chat.Completions.ChatCompletionMessageParam> = [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
        ];
        
        const response = await engine.generateCommitMessage(groupingMessages);
        
        if (!response) {
            // Fallback to directory-based grouping
            return groupFilesByDirectory(files, 'directory');
        }

        // Parse JSON response
        let groups: Array<{ files: number[]; name: string; description: string }>;
        try {
            // Clean the response - remove markdown code blocks if present
            let cleanedResponse = response.trim();
            
            // Remove markdown code blocks
            cleanedResponse = cleanedResponse.replace(/^```json\s*/i, '');
            cleanedResponse = cleanedResponse.replace(/^```\s*/i, '');
            cleanedResponse = cleanedResponse.replace(/\s*```$/i, '');
            
            // Extract JSON array (find first [ and last ])
            const firstBracket = cleanedResponse.indexOf('[');
            const lastBracket = cleanedResponse.lastIndexOf(']');
            
            if (firstBracket >= 0 && lastBracket > firstBracket) {
                cleanedResponse = cleanedResponse.substring(firstBracket, lastBracket + 1);
            }
            
            groups = JSON.parse(cleanedResponse);
            
            // Validate it's an array
            if (!Array.isArray(groups)) {
                throw new Error('Response is not an array');
            }
        } catch (parseError) {
            // If parsing fails, fallback to directory-based grouping
            console.warn(`AI grouping response parsing failed: ${(parseError as Error).message}. Using directory-based grouping.`);
            return groupFilesByDirectory(files, 'directory');
        }

        // Validate and convert to FileGroup format
        const fileGroups: FileGroup[] = [];
        const usedIndices = new Set<number>();

        for (let i = 0; i < groups.length; i++) {
            const group = groups[i];
            if (!group.files || !Array.isArray(group.files) || group.files.length === 0) {
                continue;
            }

            // Convert 1-based indices to 0-based and validate
            const fileIndices = group.files
                .map((idx: number) => idx - 1)
                .filter((idx: number) => idx >= 0 && idx < files.length && !usedIndices.has(idx));

            if (fileIndices.length === 0) {
                continue;
            }

            // Mark indices as used
            fileIndices.forEach(idx => usedIndices.add(idx));

            const groupFiles = fileIndices.map(idx => files[idx]);
            const totalSize = groupFiles.reduce((sum, f) => sum + f.size, 0);

            fileGroups.push({
                id: `ai-group-${i}`,
                name: group.name || `Group ${i + 1}`,
                description: group.description,
                files: groupFiles,
                totalSize
            });
        }

        // Add any unused files as individual groups
        for (let i = 0; i < files.length; i++) {
            if (!usedIndices.has(i)) {
                fileGroups.push({
                    id: `ai-group-${fileGroups.length}`,
                    name: files[i].filePath,
                    files: [files[i]],
                    totalSize: files[i].size
                });
            }
        }

        return fileGroups.length > 0 ? fileGroups : groupFilesByDirectory(files, 'directory');
    } catch (error) {
        // If AI analysis fails, fallback to directory-based grouping
        const err = error as Error;
        console.warn(`AI grouping analysis failed: ${err.message}. Using directory-based grouping.`);
        return groupFilesByDirectory(files, 'directory');
    }
};

