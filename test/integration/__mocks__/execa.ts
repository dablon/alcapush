// Manual mock for execa to handle ESM in Jest
export const execa = async (command: string, args: string[] = [], options: any = {}) => {
  const { execSync } = require('child_process');
  
  try {
    const cwd = options.cwd || process.cwd();
    
    // Special handling for git diff --cached (returns empty string if no staged changes)
    if (command === 'git' && args[0] === 'diff' && args[1] === '--cached') {
      try {
        // First check if we're in a git repo
        execSync('git rev-parse --git-dir', {
          encoding: 'utf-8',
          cwd: cwd,
          stdio: 'pipe',
        });
        
        // If we're in a git repo, get the diff
        const stdout = execSync(`git diff --cached`, {
          encoding: 'utf-8',
          cwd: cwd,
          stdio: 'pipe',
        });
        return {
          stdout: String(stdout || ''),
          stderr: '',
          exitCode: 0,
        };
      } catch (error: any) {
        // If not a git repo, throw error
        if (error.message.includes('not a git repository') || error.message.includes('Not a git repository')) {
          const execaError: any = new Error('Failed to get staged diff. Are you in a git repository?');
          execaError.exitCode = 128;
          execaError.stdout = '';
          execaError.stderr = error.message || '';
          throw execaError;
        }
        
        // If git diff --cached fails but we're in a repo, might mean no staged changes
        if (error.stdout === '' || error.message.includes('cached')) {
          return {
            stdout: '',
            stderr: '',
            exitCode: 0,
          };
        }
        throw error;
      }
    }
    
    // Build the full command
    const fullCommand = args.length > 0 
      ? `${command} ${args.map(arg => `"${arg}"`).join(' ')}`
      : command;
    
    let stdout: string = '';
    let stderr: string = '';
    
    try {
      const result = execSync(fullCommand, {
        encoding: 'utf-8',
        cwd: cwd,
        stdio: 'pipe',
        maxBuffer: options.maxBuffer || 10 * 1024 * 1024,
      });
      
      stdout = result ? String(result).trim() : '';
    } catch (execError: any) {
      // execSync throws on non-zero exit
      stdout = execError.stdout ? String(execError.stdout).trim() : '';
      stderr = execError.stderr ? String(execError.stderr).trim() : '';
      
      // For git commands that might legitimately return empty
      if (command === 'git') {
        // git diff (unstaged) - check if there are actual changes
        if (args[0] === 'diff' && args.length === 1) {
          // Try to get the actual diff
          try {
            const diffResult = execSync('git diff', {
              encoding: 'utf-8',
              cwd: cwd,
              stdio: 'pipe',
            });
            return {
              stdout: String(diffResult || ''),
              stderr: '',
              exitCode: 0,
            };
          } catch (diffError: any) {
            // If diff fails, return empty (no changes)
            return {
              stdout: '',
              stderr: '',
              exitCode: 0,
            };
          }
        }
        
        // git diff can return empty string (no changes)
        if (args[0] === 'diff' && stdout === '' && !stderr.includes('error')) {
          return {
            stdout: '',
            stderr: '',
            exitCode: 0,
          };
        }
        
        // git branch --show-current might return empty in some cases
        if (args[0] === 'branch' && args[1] === '--show-current' && stdout === '') {
          // Try to get branch name from git rev-parse
          try {
            const branchName = execSync('git rev-parse --abbrev-ref HEAD', {
              encoding: 'utf-8',
              cwd: cwd,
              stdio: 'pipe',
            });
            return {
              stdout: String(branchName || 'main').trim(),
              stderr: '',
              exitCode: 0,
            };
          } catch {
            return {
              stdout: 'main',
              stderr: '',
              exitCode: 0,
            };
          }
        }
      }
      
      // Re-throw for actual errors
      throw execError;
    }
    
    return {
      stdout: stdout,
      stderr: stderr,
      exitCode: 0,
    };
  } catch (error: any) {
    // If command fails, throw an error that execa would throw
    const execaError: any = new Error(`Command failed: ${command} ${args.join(' ')}`);
    execaError.exitCode = error.status || error.code || 1;
    execaError.stdout = error.stdout || '';
    execaError.stderr = error.stderr || error.message || '';
    execaError.command = `${command} ${args.join(' ')}`;
    execaError.cwd = options.cwd || process.cwd();
    throw execaError;
  }
};

