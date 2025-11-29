# Integration Tests

This directory contains integration tests for the alcapush CLI tool. These tests verify the end-to-end functionality of the application, including CLI commands, git operations, and AI engine integration.

## Test Structure

- `config.test.ts` - Tests for the `config` command (set, get, list, describe, test)
- `commit.test.ts` - Tests for the `commit` command with mocked AI responses
- `git-utils.test.ts` - Tests for git utility functions
- `e2e.test.ts` - End-to-end integration tests for complete workflows

## Test Helpers

- `helpers/git.ts` - `TestGitRepo` class for managing temporary git repositories
- `helpers/config.ts` - `TestConfig` class for managing test configuration
- `helpers/mocks.ts` - Mock AI engine for testing without actual API calls

## Running Tests

### Run all integration tests:
```bash
npm run test:integration
```

### Run a specific test file:
```bash
npm run test:integration -- config.test.ts
```

### Run tests in watch mode:
```bash
npm run test:integration -- --watch
```

## Prerequisites

1. The application must be built before running integration tests:
   ```bash
   npm run build
   ```

2. Git must be installed and available in PATH

3. The tests use temporary directories and git repositories, so ensure you have write permissions

## Test Environment

- Tests run in isolated temporary directories
- Configuration is backed up and restored between tests
- Git repositories are created and cleaned up automatically
- AI engine calls are mocked to avoid actual API usage

## Notes

- Integration tests require the built CLI (`out/cli.cjs`) to be available
- Tests use mocked AI responses to avoid API costs and ensure consistent results
- Some tests may require interactive input simulation (currently skipped or handled with `--yes` flag)


