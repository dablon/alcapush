import { analyzeBranch, formatBranchContext } from '../../src/utils/branchAnalysis';

describe('Branch Analysis Unit Tests', () => {
    describe('analyzeBranch', () => {
        it('should detect feature branch', () => {
            const context = analyzeBranch('feature/user-auth');
            
            expect(context.branchType).toBe('feature');
            expect(context.suggestedType).toBe('feat');
            expect(context.scope).toBe('user-auth');
        });

        it('should detect feat branch', () => {
            const context = analyzeBranch('feat/login');
            
            expect(context.branchType).toBe('feature');
            expect(context.suggestedType).toBe('feat');
            expect(context.scope).toBe('login');
        });

        it('should detect fix branch', () => {
            const context = analyzeBranch('fix/login-bug');
            
            expect(context.branchType).toBe('fix');
            expect(context.suggestedType).toBe('fix');
            expect(context.scope).toBe('login-bug');
        });

        it('should detect bugfix branch', () => {
            const context = analyzeBranch('bugfix/crash');
            
            expect(context.branchType).toBe('fix');
            expect(context.suggestedType).toBe('fix');
            expect(context.scope).toBe('crash');
        });

        it('should detect hotfix branch', () => {
            const context = analyzeBranch('hotfix/security-patch');
            
            expect(context.branchType).toBe('hotfix');
            expect(context.suggestedType).toBe('fix');
            expect(context.scope).toBe('security-patch');
        });

        it('should detect release branch', () => {
            const context = analyzeBranch('release/v1.0.0');
            
            expect(context.branchType).toBe('release');
            expect(context.suggestedType).toBe('chore');
            expect(context.scope).toBe('v1.0.0');
        });

        it('should detect chore branch', () => {
            const context = analyzeBranch('chore/dependencies');
            
            expect(context.branchType).toBe('chore');
            expect(context.suggestedType).toBe('chore');
            expect(context.scope).toBe('dependencies');
        });

        it('should detect docs branch', () => {
            const context = analyzeBranch('docs/readme');
            
            expect(context.branchType).toBe('docs');
            expect(context.suggestedType).toBe('docs');
            expect(context.scope).toBe('readme');
        });

        it('should detect refactor branch', () => {
            const context = analyzeBranch('refactor/utils');
            
            expect(context.branchType).toBe('refactor');
            expect(context.suggestedType).toBe('refactor');
            expect(context.scope).toBe('utils');
        });

        it('should detect test branch', () => {
            const context = analyzeBranch('test/integration');
            
            expect(context.branchType).toBe('test');
            expect(context.suggestedType).toBe('test');
            expect(context.scope).toBe('integration');
        });

        it('should detect perf branch', () => {
            const context = analyzeBranch('perf/optimization');
            
            expect(context.branchType).toBe('perf');
            expect(context.suggestedType).toBe('perf');
            expect(context.scope).toBe('optimization');
        });

        it('should handle branch without prefix', () => {
            const context = analyzeBranch('main');
            
            expect(context.branchType).toBe('other');
            expect(context.suggestedType).toBeUndefined();
            expect(context.scope).toBeUndefined();
        });

        it('should handle branch with multiple slashes', () => {
            const context = analyzeBranch('feature/api/user-auth');
            
            expect(context.branchType).toBe('feature');
            expect(context.scope).toBe('api/user-auth');
        });

        it('should handle uppercase branch names', () => {
            const context = analyzeBranch('FEATURE/USER-AUTH');
            
            expect(context.branchType).toBe('feature');
            expect(context.scope).toBe('user-auth');
        });

        it('should handle branch with ticket number', () => {
            const context = analyzeBranch('feature/JIRA-123-user-auth');
            
            expect(context.branchType).toBe('feature');
            // Should clean up ticket number (JIRA-123- gets removed)
            expect(context.scope).toBe('user-auth');
        });

        it('should handle branch with trailing numbers', () => {
            const context = analyzeBranch('feature/user-auth-123');
            
            expect(context.branchType).toBe('feature');
            // Should remove trailing numbers
            expect(context.scope).toBe('user-auth');
        });

        it('should handle branch without scope', () => {
            const context = analyzeBranch('feature');
            
            expect(context.branchType).toBe('feature');
            expect(context.scope).toBeUndefined();
        });

        it('should handle branch with dashes in name', () => {
            const context = analyzeBranch('user-auth-feature');
            
            expect(context.branchType).toBe('other');
            // Should try to extract scope
            expect(context.scope).toBe('user-auth');
        });

        it('should preserve branch name', () => {
            const branchName = 'feature/user-auth';
            const context = analyzeBranch(branchName);
            
            expect(context.branchName).toBe(branchName);
        });
    });

    describe('formatBranchContext', () => {
        it('should format branch context with all information', () => {
            const context = analyzeBranch('feature/user-auth');
            const formatted = formatBranchContext(context);
            
            expect(formatted).toContain('Current branch: feature/user-auth');
            expect(formatted).toContain('Branch type: feature');
            expect(formatted).toContain('Suggested commit type: feat');
            expect(formatted).toContain('Suggested scope: user-auth');
        });

        it('should format branch context without scope', () => {
            const context = analyzeBranch('main');
            const formatted = formatBranchContext(context);
            
            expect(formatted).toContain('Current branch: main');
            expect(formatted).toContain('Branch type: other');
            expect(formatted).not.toContain('Suggested commit type');
            expect(formatted).not.toContain('Suggested scope');
        });

        it('should format branch context with type but no scope', () => {
            const context = analyzeBranch('feature');
            const formatted = formatBranchContext(context);
            
            expect(formatted).toContain('Current branch: feature');
            expect(formatted).toContain('Branch type: feature');
            expect(formatted).toContain('Suggested commit type: feat');
            expect(formatted).not.toContain('Suggested scope');
        });
    });
});

