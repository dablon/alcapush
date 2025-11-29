export interface BranchContext {
    branchName: string;
    branchType: 'feature' | 'fix' | 'hotfix' | 'bugfix' | 'release' | 'chore' | 'docs' | 'refactor' | 'test' | 'perf' | 'other';
    scope?: string;
    suggestedType?: string;
}

/**
 * Analyze branch name to extract context
 */
export const analyzeBranch = (branchName: string): BranchContext => {
    const normalized = branchName.toLowerCase().trim();
    
    // Common branch patterns:
    // - feature/scope-name
    // - feat/scope-name
    // - fix/scope-name
    // - bugfix/scope-name
    // - hotfix/scope-name
    // - release/version
    // - chore/scope-name
    // - docs/scope-name
    // - refactor/scope-name
    // - test/scope-name
    // - perf/scope-name
    
    const parts = normalized.split('/');
    const prefix = parts[0];
    const scope = parts.length > 1 ? parts.slice(1).join('/') : undefined;
    
    let branchType: BranchContext['branchType'] = 'other';
    let suggestedType: string | undefined;
    
    // Map branch prefixes to types
    if (prefix.startsWith('feat') || prefix === 'feature') {
        branchType = 'feature';
        suggestedType = 'feat';
    } else if (prefix === 'fix' || prefix === 'bugfix') {
        branchType = 'fix';
        suggestedType = 'fix';
    } else if (prefix === 'hotfix') {
        branchType = 'hotfix';
        suggestedType = 'fix';
    } else if (prefix === 'release') {
        branchType = 'release';
        suggestedType = 'chore';
    } else if (prefix === 'chore') {
        branchType = 'chore';
        suggestedType = 'chore';
    } else if (prefix === 'doc' || prefix === 'docs') {
        branchType = 'docs';
        suggestedType = 'docs';
    } else if (prefix === 'refactor') {
        branchType = 'refactor';
        suggestedType = 'refactor';
    } else if (prefix === 'test' || prefix === 'tests') {
        branchType = 'test';
        suggestedType = 'test';
    } else if (prefix === 'perf' || prefix === 'performance') {
        branchType = 'perf';
        suggestedType = 'perf';
    }
    
    // Extract scope from branch name
    // Examples:
    // - feature/user-auth -> scope: "user-auth"
    // - fix/login-bug -> scope: "login-bug"
    // - feature/api -> scope: "api"
    let extractedScope: string | undefined = scope;
    
    // If no scope in prefix format, try to extract from branch name
    // e.g., "user-auth-feature" -> scope: "user-auth"
    if (!extractedScope && normalized.includes('-')) {
        // Try to find meaningful scope
        const words = normalized.split('-');
        if (words.length > 1) {
            // Remove common suffixes/prefixes
            const filtered = words.filter(w => 
                !['feature', 'feat', 'fix', 'bug', 'hotfix', 'chore', 'doc', 'docs', 'refactor', 'test', 'perf'].includes(w)
            );
            if (filtered.length > 0) {
                extractedScope = filtered.join('-');
            }
        }
    }
    
    // Clean up scope (remove ticket numbers, etc.)
    if (extractedScope) {
        // Remove common patterns like ticket numbers (e.g., JIRA-123, #123)
        // But be careful not to remove valid parts
        let cleaned = extractedScope;
        
        // Remove ticket patterns: JIRA-123, TICKET-456, etc.
        cleaned = cleaned.replace(/^[a-z]+-\d+-/i, ''); // Remove prefix-ticket- pattern at start
        cleaned = cleaned.replace(/-\d+-/g, '-'); // Remove middle ticket numbers
        cleaned = cleaned.replace(/^[a-z]+#\d+-/i, ''); // Remove prefix#ticket- pattern
        
        // Only remove trailing numbers if they look like ticket numbers (3+ digits)
        // Don't remove short numbers that might be part of the name
        cleaned = cleaned.replace(/-\d{3,}$/, ''); // Remove trailing ticket numbers (3+ digits)
        
        cleaned = cleaned.trim();
        
        // Clean up any double dashes
        cleaned = cleaned.replace(/--+/g, '-');
        
        // Remove leading/trailing dashes
        cleaned = cleaned.replace(/^-+|-+$/g, '');
        
        // If scope is empty after cleaning, don't use it
        if (!cleaned || cleaned.length === 0) {
            extractedScope = undefined;
        } else {
            extractedScope = cleaned;
        }
    }
    
    return {
        branchName,
        branchType,
        scope: extractedScope,
        suggestedType
    };
};

/**
 * Format branch context for prompt
 */
export const formatBranchContext = (context: BranchContext): string => {
    const parts: string[] = [];
    
    parts.push(`Current branch: ${context.branchName}`);
    
    // Always show branch type
    parts.push(`Branch type: ${context.branchType}`);
    
    // Only show suggested type and scope if they exist and branch type is not 'other'
    if (context.suggestedType) {
        parts.push(`Suggested commit type: ${context.suggestedType}`);
    }
    
    if (context.scope) {
        parts.push(`Suggested scope: ${context.scope}`);
    }
    
    return parts.join('\n');
};

