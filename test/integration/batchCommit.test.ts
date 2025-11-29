import {
  splitDiffByFiles,
  groupFilesByDirectory,
  combineFileDiffs,
  formatSize,
  estimateTokens,
  generateBatchCommits,
  FileDiff,
  FileGroup,
} from '../../src/utils/batchCommit';
import { BranchContext } from '../../src/utils/branchAnalysis';

// Mock the engine module
jest.mock('../../src/utils/engine', () => {
  const { MockAiEngine } = require('./helpers/mocks');
  return {
    getEngine: jest.fn(() => {
      const mockEngine = new MockAiEngine({
        model: 'gpt-4o-mini',
        apiKey: 'sk-test',
        maxTokensOutput: 500,
        maxTokensInput: 4096,
      });
      mockEngine.setResponse('default', 'test: commit message from AI');
      return mockEngine;
    }),
  };
});

// Mock generateCommitMessageByDiff
const mockGenerateCommitMessage = jest.fn(async (diff: string) => {
  if (diff.includes('feature')) {
    return 'feat: add new feature';
  }
  if (diff.includes('fix')) {
    return 'fix: resolve bug';
  }
  if (diff.includes('docs')) {
    return 'docs: update documentation';
  }
  return 'test: commit message';
});

jest.mock('../../src/generateCommitMessage', () => ({
  generateCommitMessageByDiff: jest.fn((diff: string) => mockGenerateCommitMessage(diff)),
}));

describe('Batch Commit Utils Unit Tests', () => {
  describe('splitDiffByFiles', () => {
    it('should return empty array for empty diff', () => {
      const result = splitDiffByFiles('');
      expect(result).toEqual([]);
    });

    it('should split single file diff', () => {
      const diff = `diff --git a/src/file1.ts b/src/file1.ts
index 1234567..abcdefg 100644
--- a/src/file1.ts
+++ b/src/file1.ts
@@ -1,3 +1,3 @@
-const old = 'value';
+const new = 'value';
`;

      const result = splitDiffByFiles(diff);
      expect(result).toHaveLength(1);
      expect(result[0].filePath).toBe('src/file1.ts');
      expect(result[0].diff).toContain('diff --git');
      expect(result[0].size).toBeGreaterThan(0);
    });

    it('should split multiple file diffs', () => {
      const diff = `diff --git a/src/file1.ts b/src/file1.ts
index 1234567..abcdefg 100644
--- a/src/file1.ts
+++ b/src/file1.ts
@@ -1,3 +1,3 @@
-const old = 'value';
+const new = 'value';

diff --git a/src/file2.ts b/src/file2.ts
index 1234567..abcdefg 100644
--- a/src/file2.ts
+++ b/src/file2.ts
@@ -1,3 +1,3 @@
-const old2 = 'value';
+const new2 = 'value';
`;

      const result = splitDiffByFiles(diff);
      expect(result).toHaveLength(2);
      expect(result[0].filePath).toBe('src/file1.ts');
      expect(result[1].filePath).toBe('src/file2.ts');
    });

    it('should merge duplicate file entries', () => {
      const diff = `diff --git a/src/file1.ts b/src/file1.ts
index 1234567..abcdefg 100644
--- a/src/file1.ts
+++ b/src/file1.ts
@@ -1,3 +1,3 @@
-const old = 'value';
+const new = 'value';

diff --git a/src/file1.ts b/src/file1.ts
index abcdefg..hijklmn 100644
--- a/src/file1.ts
+++ b/src/file1.ts
@@ -1,3 +1,3 @@
-const new = 'value';
+const newer = 'value';
`;

      const result = splitDiffByFiles(diff);
      expect(result).toHaveLength(1);
      expect(result[0].filePath).toBe('src/file1.ts');
      expect(result[0].diff).toContain('diff --git');
      // Should contain both diffs
      expect(result[0].diff.split('diff --git').length).toBe(3); // 2 diffs + empty first part
    });

    it('should handle files with spaces in path', () => {
      const diff = `diff --git a/src/my file.ts b/src/my file.ts
index 1234567..abcdefg 100644
--- a/src/my file.ts
+++ b/src/my file.ts
@@ -1,3 +1,3 @@
-const old = 'value';
+const new = 'value';
`;

      const result = splitDiffByFiles(diff);
      expect(result).toHaveLength(1);
      expect(result[0].filePath).toBe('src/my file.ts');
    });
  });

  describe('groupFilesByDirectory', () => {
    const createFileDiff = (filePath: string, content: string = 'test'): FileDiff => ({
      filePath,
      diff: `diff --git a/${filePath} b/${filePath}\n${content}`,
      size: content.length,
    });

    it('should group by file when groupBy is "file"', () => {
      const files = [
        createFileDiff('src/file1.ts'),
        createFileDiff('src/file2.ts'),
        createFileDiff('src/utils/file3.ts'),
      ];

      const result = groupFilesByDirectory(files, 'file');
      expect(result).toHaveLength(3);
      expect(result[0].name).toBe('src/file1.ts');
      expect(result[1].name).toBe('src/file2.ts');
      expect(result[2].name).toBe('src/utils/file3.ts');
      expect(result[0].files).toHaveLength(1);
    });

    it('should group by directory when groupBy is "directory"', () => {
      const files = [
        createFileDiff('src/file1.ts'),
        createFileDiff('src/file2.ts'),
        createFileDiff('src/utils/file3.ts'),
        createFileDiff('src/utils/file4.ts'),
        createFileDiff('test/file5.ts'),
      ];

      const result = groupFilesByDirectory(files, 'directory');
      expect(result.length).toBeGreaterThan(0);
      
      // Find groups by directory
      const srcGroup = result.find(g => g.name.includes('src ('));
      const utilsGroup = result.find(g => g.name.includes('src/utils'));
      const testGroup = result.find(g => g.name.includes('test'));

      expect(srcGroup).toBeDefined();
      if (srcGroup) {
        expect(srcGroup.files.length).toBe(2); // file1.ts and file2.ts
      }

      expect(utilsGroup).toBeDefined();
      if (utilsGroup) {
        expect(utilsGroup.files.length).toBe(2); // file3.ts and file4.ts
      }

      expect(testGroup).toBeDefined();
      if (testGroup) {
        expect(testGroup.files.length).toBe(1); // file5.ts
      }
    });

    it('should handle root directory files', () => {
      const files = [
        createFileDiff('file1.ts'),
        createFileDiff('file2.ts'),
        createFileDiff('src/file3.ts'),
      ];

      const result = groupFilesByDirectory(files, 'directory');
      const rootGroup = result.find(g => g.name.includes('. (') || g.name === '.');
      expect(rootGroup).toBeDefined();
      if (rootGroup) {
        expect(rootGroup.files.length).toBe(2); // file1.ts and file2.ts
      }
    });

    it('should calculate total size correctly', () => {
      const files = [
        createFileDiff('src/file1.ts', 'content1'),
        createFileDiff('src/file2.ts', 'content2'),
      ];

      const result = groupFilesByDirectory(files, 'directory');
      const group = result.find(g => g.name.includes('src'));
      expect(group).toBeDefined();
      if (group) {
        expect(group.totalSize).toBeGreaterThan(0);
        expect(group.totalSize).toBe(group.files.reduce((sum, f) => sum + f.size, 0));
      }
    });
  });

  describe('combineFileDiffs', () => {
    it('should combine multiple file diffs', () => {
      const files: FileDiff[] = [
        {
          filePath: 'file1.ts',
          diff: 'diff --git a/file1.ts b/file1.ts\ncontent1',
          size: 50,
        },
        {
          filePath: 'file2.ts',
          diff: 'diff --git a/file2.ts b/file2.ts\ncontent2',
          size: 50,
        },
      ];

      const result = combineFileDiffs(files);
      expect(result).toContain('file1.ts');
      expect(result).toContain('file2.ts');
      expect(result).toContain('content1');
      expect(result).toContain('content2');
    });

    it('should return empty string for empty array', () => {
      const result = combineFileDiffs([]);
      expect(result).toBe('');
    });
  });

  describe('formatSize', () => {
    it('should format bytes correctly', () => {
      expect(formatSize(0)).toBe('0 B');
      expect(formatSize(512)).toBe('512 B');
      expect(formatSize(1024)).toBe('1.0 KB');
      expect(formatSize(1536)).toBe('1.5 KB');
      expect(formatSize(1024 * 1024)).toBe('1.0 MB');
      expect(formatSize(2.5 * 1024 * 1024)).toBe('2.5 MB');
    });
  });

  describe('estimateTokens', () => {
    it('should estimate tokens for small text', () => {
      const smallText = 'This is a small text';
      const result = estimateTokens(smallText);
      expect(result).toBeGreaterThan(0);
      expect(result).toBeLessThan(100);
    });

    it('should estimate tokens for large text', () => {
      const largeText = 'x'.repeat(10000);
      const result = estimateTokens(largeText);
      expect(result).toBeGreaterThan(1000);
    });
  });

  describe('generateBatchCommits', () => {
    it('should generate commit messages for file groups', async () => {
      const groups: FileGroup[] = [
        {
          id: 'group1',
          name: 'src/file1.ts',
          files: [
            {
              filePath: 'src/file1.ts',
              diff: 'diff --git a/src/file1.ts b/src/file1.ts\nfeature code',
              size: 100,
            },
          ],
          totalSize: 100,
        },
        {
          id: 'group2',
          name: 'src/file2.ts',
          files: [
            {
              filePath: 'src/file2.ts',
              diff: 'diff --git a/src/file2.ts b/src/file2.ts\nfix code',
              size: 100,
            },
          ],
          totalSize: 100,
        },
      ];

      const branchContext: BranchContext = {
        branchName: 'main',
        branchType: 'other',
      };

      const result = await generateBatchCommits(groups, false, '', branchContext);
      expect(result).toHaveLength(2);
      expect(result[0].message).toContain('feat');
      expect(result[1].message).toContain('fix');
      expect(result[0].confirmed).toBe(false);
    });

    it('should handle errors gracefully', async () => {
      // Mock generateCommitMessageByDiff to throw
      mockGenerateCommitMessage.mockRejectedValueOnce(new Error('API error'));

      const groups: FileGroup[] = [
        {
          id: 'group1',
          name: 'src/file1.ts',
          files: [
            {
              filePath: 'src/file1.ts',
              diff: 'diff --git a/src/file1.ts b/src/file1.ts\ncontent',
              size: 100,
            },
          ],
          totalSize: 100,
        },
      ];

      const result = await generateBatchCommits(groups, false, '', undefined);
      expect(result).toHaveLength(1);
      expect(result[0].message).toBe('Update src/file1.ts');
      
      // Reset mock for other tests
      mockGenerateCommitMessage.mockReset();
      mockGenerateCommitMessage.mockImplementation(async (diff: string) => {
        if (diff.includes('feature')) {
          return 'feat: add new feature';
        }
        if (diff.includes('fix')) {
          return 'fix: resolve bug';
        }
        if (diff.includes('docs')) {
          return 'docs: update documentation';
        }
        return 'test: commit message';
      });
    });
  });
});

