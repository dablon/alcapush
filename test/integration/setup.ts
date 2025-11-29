import { existsSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';

// Clean up any leftover test directories
const testDir = join(__dirname, 'tmp');
if (existsSync(testDir)) {
  rmSync(testDir, { recursive: true, force: true });
}
mkdirSync(testDir, { recursive: true });

// Set test environment variables
process.env.NODE_ENV = 'test';

