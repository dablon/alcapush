# Publishing Guide for Alcapush

## Prerequisites

1. **Create an npm account** (if you don't have one):
   - Go to https://www.npmjs.com/signup
   - Create a free account

2. **Login to npm via CLI**:
   ```bash
   npm login
   ```
   Enter your username, password, and email when prompted.

3. **Verify you're logged in**:
   ```bash
   npm whoami
   ```

## Pre-Publishing Checklist

Before publishing, make sure to:

1. **Update package.json placeholders**:
   - ✅ Update `repository.url` with your actual GitHub repository URL
   - ✅ Update `author` with your name and email (format: "Your Name <email@example.com>")
   - ✅ Verify the package `name` is available on npm (check at https://www.npmjs.com/package/alcapush)

2. **Check package name availability**:
   ```bash
   npm view alcapush
   ```
   If it returns 404, the name is available. If it returns package info, the name is taken.

3. **Build the project**:
   ```bash
   npm run build
   ```
   Verify that `out/cli.cjs` is created successfully.

4. **Test the build**:
   ```bash
   npm link
   acp --help
   ```
   Make sure the CLI works correctly.

5. **Run tests** (optional but recommended):
   ```bash
   npm test
   ```

## Publishing Steps

### First Time Publishing

1. **Dry run** (see what would be published without actually publishing):
   ```bash
   npm publish --dry-run
   ```
   This shows you exactly what files will be included in the package.

2. **Publish to npm**:
   ```bash
   npm publish
   ```
   
   The `prepublishOnly` script will automatically:
   - Run `npm run build` to create the latest build
   - Then publish the package

3. **Verify publication**:
   - Check https://www.npmjs.com/package/alcapush
   - Try installing it: `npm install -g alcapush`

### Publishing Updates

When you want to publish a new version:

1. **Update version** (choose one):
   ```bash
   # Patch version (1.0.0 -> 1.0.1) - bug fixes
   npm version patch
   
   # Minor version (1.0.0 -> 1.1.0) - new features
   npm version minor
   
   # Major version (1.0.0 -> 2.0.0) - breaking changes
   npm version major
   ```
   
   Or manually edit `package.json` and update the `version` field.

2. **Commit the version change**:
   ```bash
   git add package.json
   git commit -m "chore: bump version to X.X.X"
   git tag vX.X.X
   git push && git push --tags
   ```

3. **Publish**:
   ```bash
   npm publish
   ```

## Publishing Scoped Packages (Optional)

If the package name is taken, you can publish as a scoped package:

1. **Update package.json**:
   ```json
   {
     "name": "@yourusername/alcapush",
     ...
   }
   ```

2. **Publish as public** (scoped packages are private by default):
   ```bash
   npm publish --access public
   ```

## Troubleshooting

### Package name already taken
- Use a scoped package: `@yourusername/alcapush`
- Or choose a different name

### Authentication errors
```bash
npm logout
npm login
```

### Publishing fails
- Make sure you're logged in: `npm whoami`
- Check if package name is available
- Verify build succeeds: `npm run build`
- Check npm registry: `npm config get registry` (should be https://registry.npmjs.org/)

### Unpublishing (within 72 hours)
```bash
npm unpublish alcapush@1.0.0
```
⚠️ **Warning**: Only unpublish if absolutely necessary. After 72 hours, you cannot unpublish.

## Post-Publishing

1. **Install and test globally**:
   ```bash
   npm install -g alcapush
   acp --version
   ```

2. **Update README.md** if needed with installation instructions

3. **Create a GitHub release** (optional but recommended):
   - Go to your GitHub repository
   - Create a new release with the version tag
   - Add release notes

## Best Practices

1. **Use semantic versioning** (semver):
   - MAJOR.MINOR.PATCH (e.g., 1.2.3)
   - MAJOR: Breaking changes
   - MINOR: New features (backward compatible)
   - PATCH: Bug fixes (backward compatible)

2. **Write good commit messages** before publishing

3. **Test thoroughly** before publishing

4. **Keep CHANGELOG.md** (optional but recommended) to track changes

5. **Use npm scripts** for versioning:
   ```bash
   npm version patch -m "Release v%s"
   ```

