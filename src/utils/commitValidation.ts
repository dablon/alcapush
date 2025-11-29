/**
 * Validates commit messages against Conventional Commits specification
 * https://www.conventionalcommits.org/
 */

export interface ValidationResult {
    valid: boolean;
    errors: string[];
    warnings: string[];
}

/**
 * Conventional Commits types
 */
const CONVENTIONAL_TYPES = [
    'feat',      // A new feature
    'fix',       // A bug fix
    'docs',      // Documentation only changes
    'style',     // Changes that do not affect the meaning of the code
    'refactor',  // A code change that neither fixes a bug nor adds a feature
    'perf',      // A code change that improves performance
    'test',      // Adding missing tests or correcting existing tests
    'build',     // Changes that affect the build system or external dependencies
    'ci',        // Changes to CI configuration files and scripts
    'chore',     // Other changes that don't modify src or test files
    'revert',    // Reverts a previous commit
] as const;

/**
 * Common commitlint rules
 */
const MAX_SUBJECT_LENGTH = 72;
const MAX_BODY_LINE_LENGTH = 100;
const MIN_SUBJECT_LENGTH = 10;

/**
 * Parse commit message into parts
 */
interface ParsedCommit {
    type: string | null;
    scope: string | null;
    subject: string;
    body: string;
    footer: string;
    breaking: boolean;
}

const parseCommitMessage = (message: string): ParsedCommit => {
    const lines = message.trim().split('\n');
    const header = lines[0] || '';
    
    // Parse header: type(scope): subject
    // Examples:
    // - feat: add new feature
    // - fix(scope): fix bug
    // - feat!: breaking change
    const headerMatch = header.match(/^(\w+)(?:\(([^)]+)\))?(!)?:\s*(.+)$/);
    
    let type: string | null = null;
    let scope: string | null = null;
    let subject: string = header;
    let breaking = false;
    
    if (headerMatch) {
        type = headerMatch[1];
        scope = headerMatch[2] || null;
        breaking = !!headerMatch[3];
        subject = headerMatch[4] || '';
    }
    
    // Parse body and footer
    let body = '';
    let footer = '';
    let inFooter = false;
    
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        
        // Footer starts after a blank line and contains tokens like BREAKING CHANGE, Closes, etc.
        if (inFooter || (line.match(/^(BREAKING CHANGE|Closes|Fixes|Refs):/i) && i > 1 && lines[i - 1] === '')) {
            inFooter = true;
            footer += (footer ? '\n' : '') + line;
        } else if (line.trim() === '') {
            // Blank line can separate body from footer
            if (body && !inFooter) {
                inFooter = true;
            } else if (!body) {
                // Skip leading blank lines
                continue;
            } else {
                body += '\n';
            }
        } else {
            if (inFooter) {
                footer += '\n' + line;
            } else {
                body += (body ? '\n' : '') + line;
            }
        }
    }
    
    return {
        type,
        scope,
        subject,
        body,
        footer,
        breaking
    };
};

/**
 * Validate commit message against Conventional Commits
 */
export const validateCommitMessage = (message: string): ValidationResult => {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    if (!message || !message.trim()) {
        return {
            valid: false,
            errors: ['Commit message cannot be empty'],
            warnings: []
        };
    }
    
    const parsed = parseCommitMessage(message);
    const header = message.split('\n')[0] || '';
    
    // Check if it follows conventional commits format
    if (!parsed.type) {
        errors.push('Commit message must follow Conventional Commits format: "type(scope): subject"');
        return {
            valid: false,
            errors,
            warnings
        };
    }
    
    // Validate type
    if (!CONVENTIONAL_TYPES.includes(parsed.type as any)) {
        warnings.push(
            `Type "${parsed.type}" is not a standard Conventional Commits type. ` +
            `Standard types: ${CONVENTIONAL_TYPES.join(', ')}`
        );
    }
    
    // Validate subject length
    if (parsed.subject.length < MIN_SUBJECT_LENGTH) {
        warnings.push(`Subject is too short (${parsed.subject.length} chars, minimum ${MIN_SUBJECT_LENGTH} recommended)`);
    }
    
    if (parsed.subject.length > MAX_SUBJECT_LENGTH) {
        errors.push(
            `Subject line is too long (${parsed.subject.length} chars, maximum ${MAX_SUBJECT_LENGTH})`
        );
    }
    
    // Validate header length (entire first line)
    if (header.length > MAX_SUBJECT_LENGTH) {
        errors.push(
            `Header line is too long (${header.length} chars, maximum ${MAX_SUBJECT_LENGTH})`
        );
    }
    
    // Validate subject format
    if (parsed.subject.trim() !== parsed.subject) {
        warnings.push('Subject should not have leading or trailing whitespace');
    }
    
    if (parsed.subject.endsWith('.')) {
        warnings.push('Subject should not end with a period');
    }
    
    // Validate body line length
    if (parsed.body) {
        const bodyLines = parsed.body.split('\n');
        for (let i = 0; i < bodyLines.length; i++) {
            const line = bodyLines[i];
            if (line.length > MAX_BODY_LINE_LENGTH) {
                warnings.push(
                    `Body line ${i + 1} is too long (${line.length} chars, maximum ${MAX_BODY_LINE_LENGTH} recommended)`
                );
            }
        }
    }
    
    // Validate footer format
    if (parsed.footer) {
        const footerLines = parsed.footer.split('\n');
        for (const line of footerLines) {
            if (line.trim() && !line.match(/^(BREAKING CHANGE|Closes|Fixes|Refs|See also):/i)) {
                // Not a strict error, but warn if footer doesn't follow common patterns
                if (!line.includes(':')) {
                    warnings.push('Footer lines should follow format "Token: description"');
                }
            }
        }
    }
    
    // Check for breaking changes
    if (parsed.breaking || parsed.footer.toLowerCase().includes('breaking change')) {
        // Breaking changes should be documented
        if (!parsed.footer.toLowerCase().includes('breaking change') && !parsed.breaking) {
            warnings.push('Breaking changes should be documented in the footer with "BREAKING CHANGE:"');
        }
    }
    
    return {
        valid: errors.length === 0,
        errors,
        warnings
    };
};

/**
 * Validate commit message from file (for commit-msg hook)
 */
export const validateCommitMessageFromFile = async (filePath: string): Promise<ValidationResult> => {
    const { readFileSync } = await import('fs');
    try {
        const message = readFileSync(filePath, 'utf-8');
        return validateCommitMessage(message);
    } catch (error) {
        return {
            valid: false,
            errors: [`Failed to read commit message file: ${(error as Error).message}`],
            warnings: []
        };
    }
};

