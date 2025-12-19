# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Alcapush is an AI-powered git commit message generator CLI tool (fork of opencommit) that supports multiple AI providers (OpenAI GPT-5-nano/GPT-4, Anthropic Claude, Google Gemini, Ollama). It generates conventional commit messages with optional GitMoji support, branch-aware context, and AI-powered batch commit splitting.

## Development Commands

### Building and Development
```bash
npm run build          # Build with esbuild (outputs to out/cli.cjs)
npm run dev            # Run CLI in development mode with ts-node
npm start              # Run the built CLI
npm run watch          # Build with watch mode and sourcemaps
```

### Testing
```bash
npm test               # Run unit tests only (test/unit)
npm run test:integration  # Build first, then run integration tests
npm run test:all       # Run all tests (both unit and integration)
```

**Running Single Tests:**
```bash
# Run specific integration test file
npm run build && npx jest test/integration/batch.test.ts

# Run specific unit test file
npx jest test/unit/yourfile.test.ts
```

### Code Quality
```bash
npm run lint           # ESLint + TypeScript type checking
npm run format         # Format code with Prettier
```

### Publishing
```bash
npm run prepublishOnly # Automatically runs build before publishing
```

### CI/CD
The repository uses GitHub Actions for automated publishing:
- **Workflow**: `.github/workflows/publish.yml`
- **Trigger**: Push to `main` or `master` branch
- **Steps**: Lint → Test → Build → Version Check → Publish to NPM
- **Smart Publishing**: Only publishes if package version doesn't exist on npm
- **Auto-tagging**: Creates git tags for published versions (e.g., `v1.0.7`)
- **Required Secret**: `NPM_TOKEN` must be set in GitHub repository secrets

## Architecture

### Entry Point & CLI
- **src/cli.ts**: Main CLI entry using `cleye` for command parsing. Handles:
  - Default commit command (when no subcommand specified)
  - Git hook modes (`--hook-mode`, `--validate-commit-msg`)
  - Command routing to config/hook/history/favorite/batch subcommands

### Core Commit Flow
1. **src/commands/commit.ts**: Main commit command implementation
2. **src/generateCommitMessage.ts**: Core message generation logic
   - Token counting and diff truncation with binary search
   - Diff filtering and splitting for large changes
   - Branch context integration
   - Handles token limits with iterative truncation (SAFETY_MARGIN of 100 tokens)
3. **src/prompts.ts**: System prompts for AI with Conventional Commits format

### AI Engine Abstraction
- **src/utils/engine.ts**: Factory pattern for AI provider selection
- **src/engine/**: Individual provider implementations
  - `openai.ts`: OpenAI with GPT-5-nano fallback to gpt-4o-mini
  - `anthropic.ts`: Claude models
  - `gemini.ts`: Google Gemini
  - `ollama.ts`: Local Ollama models
- All engines implement `AiEngine` interface from `src/types.ts`

### Batch Commit System
- **src/commands/batch.ts**: CLI command for splitting changes into N commits
- **src/utils/batchCommit.ts**: AI-powered file grouping logic
  - Uses AI to analyze files and create logical groupings
  - Validates files have actual changes before staging
  - Unstages all files before committing each group (ensures atomic commits)

### Git Integration
- **src/utils/git.ts**: All git operations (diff, commit, push, branch detection)
  - Uses `execa` for running git commands
  - Handles staged/unstaged diffs, file staging/unstaging

### Configuration System
- **src/utils/config.ts**: Config management using INI files
  - Location: `~/.alcapush/config.ini`
  - Migrates old format (`.alcapush` as file) to directory structure
  - Environment variables override file config
  - See `src/types.ts` for `alcapushConfig` interface and `DEFAULT_CONFIG`

### Branch Analysis
- **src/utils/branchAnalysis.ts**: Extracts context from branch names
  - Recognizes patterns: `feature/`, `fix/`, `hotfix/`, `chore/`, etc.
  - Extracts scope from branch (e.g., `feature/user-auth` → scope: `user-auth`)
  - Cleans ticket numbers (e.g., `JIRA-123-auth` → `auth`)

### Storage & History
- **src/utils/storage.ts**: Commit history and favorites (stored in `~/.alcapush/`)
- **src/commands/history.ts**: History and favorites commands

### Token Management
- **src/utils/tokenCount.ts**: Token counting using `@dqbd/tiktoken`
- **src/utils/costEstimation.ts**: Real-time API cost estimation
- **src/generateCommitMessage.ts**:
  - `ADJUSTMENT_FACTOR = 20` for safety margin
  - `SAFETY_MARGIN = 100` tokens in validation
  - Binary search truncation for precise token limits

### Build Configuration
- **esbuild.config.js**: Bundles to CommonJS (`out/cli.cjs`) with:
  - Target: Node 18
  - External: `tiktoken`, `@dqbd/tiktoken` (not bundled)
  - Shebang: `#!/usr/bin/env node`
  - Minified production build

### Test Configuration
- **Unit tests**: Jest with ts-jest
- **Integration tests**: `jest.config.integration.cjs`
  - 30s timeout
  - Mocks `execa` module (see `test/integration/__mocks__/execa.ts`)
  - Setup in `test/integration/setup.ts`

## Key Technical Details

### Token Handling Strategy
The codebase uses a multi-layered approach to handle token limits:
1. **Approximation first**: Uses `length / 4` for quick checks before expensive token counting
2. **Iterative truncation**: `validateAndTruncateMessages()` iteratively truncates until under limit (max 5 iterations)
3. **Binary search fallback**: `truncateDiffByBinarySearch()` as last resort for precise cutoff
4. **Diff-aware truncation**: `truncateDiffByTokens()` preserves complete files when possible

### AI Engine Selection
Engines are selected based on `ACP_AI_PROVIDER` config:
- Default: OpenAI with GPT-5-nano (auto-fallback to gpt-4o-mini if unavailable)
- Azure: Uses OpenAI engine with custom baseURL
- All engines share same `AiEngine` interface for generateCommitMessage()

### Git Hooks
- `prepare-commit-msg`: Auto-generates messages when running `git commit` (no -m flag)
- `commit-msg`: Validates against Conventional Commits spec
- Installed to `.git/hooks/` via `src/utils/hooks.ts`

### Batch Commit File Validation
The batch command validates files at multiple stages:
1. Split diff into file diffs
2. Check git for actual changed files (staged + unstaged)
3. Filter file diffs to only include files with real changes
4. Before each commit, re-check which files still have changes
5. Validate file paths (no newlines, template strings, reasonable length)

### Configuration Precedence
1. Default config in `src/types.ts`
2. Config file at `~/.alcapush/config.ini`
3. Environment variables (highest priority)

## Common Patterns

### Adding a New AI Provider
1. Create new engine file in `src/engine/` implementing `AiEngine` interface
2. Add provider to `AIProvider` enum in `src/types.ts`
3. Add case in `getEngine()` switch in `src/utils/engine.ts`
4. Update cost estimation in `src/utils/costEstimation.ts` if applicable

### Modifying Commit Message Format
- Main prompt logic in `src/prompts.ts` → `getMainCommitPrompt()`
- Conventional Commits format enforced here
- Branch context injected via `BranchContext` parameter

### Working with Token Limits
- Always use `tokenCount()` from `src/utils/tokenCount.ts` (not raw string length)
- Check `MAX_TOKENS_INPUT` and `MAX_TOKENS_OUTPUT` from config
- Account for `ADJUSTMENT_FACTOR` (20) and `SAFETY_MARGIN` (100) in calculations
- Use `validateAndTruncateMessages()` before sending to AI

### Testing Integration Features
Integration tests mock git commands via `test/integration/__mocks__/execa.ts`. When adding new git operations:
1. Update the execa mock if needed
2. Use helpers in `test/integration/helpers/git.ts` and `test/integration/helpers/config.ts`
3. Build first with `npm run build` before running integration tests
