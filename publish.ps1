# PowerShell script to publish alcapush to npm
# Usage: .\publish.ps1 [--skip-tests] [--skip-git] [--dry-run]

param(
    [switch]$SkipTests,
    [switch]$SkipGit,
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"

# Colors for output
function Write-Info { Write-Host $args -ForegroundColor Cyan }
function Write-Success { Write-Host $args -ForegroundColor Green }
function Write-Warning { Write-Host $args -ForegroundColor Yellow }
function Write-Error { Write-Host $args -ForegroundColor Red }

# Get current version from package.json
function Get-CurrentVersion {
    $packageJson = Get-Content "package.json" | ConvertFrom-Json
    return $packageJson.version
}

# Increment the last digit (patch version) of a semantic version
function Increment-PatchVersion {
    param([string]$Version)
    
    if ($Version -match '^(\d+)\.(\d+)\.(\d+)(.*)$') {
        $major = [int]$matches[1]
        $minor = [int]$matches[2]
        $patch = [int]$matches[3]
        $suffix = $matches[4]
        
        $newPatch = $patch + 1
        return "$major.$minor.$newPatch$suffix"
    } else {
        Write-Error "Invalid version format: $Version. Expected format: X.Y.Z"
        return $null
    }
}

# Update version in package.json
function Set-PackageVersion {
    param([string]$NewVersion)
    
    try {
        $packageJsonPath = "package.json"
        $packageJson = Get-Content $packageJsonPath -Raw | ConvertFrom-Json
        $packageJson.version = $NewVersion
        
        # Convert back to JSON with proper formatting
        $jsonContent = $packageJson | ConvertTo-Json -Depth 10
        
        # Write to file with UTF-8 encoding (no BOM for npm compatibility)
        [System.IO.File]::WriteAllText(
            (Resolve-Path $packageJsonPath),
            $jsonContent,
            [System.Text.UTF8Encoding]::new($false)
        )
        
        return $true
    } catch {
        Write-Error "Failed to update package.json: $_"
        return $false
    }
}

# Check if npm is logged in
function Test-NpmLogin {
    Write-Info "Checking npm authentication..."
    try {
        $whoami = npm whoami 2>&1
        if ($LASTEXITCODE -ne 0) {
            Write-Error "Not logged in to npm. Please run: npm login"
            return $false
        }
        Write-Success "Logged in as: $whoami"
        return $true
    } catch {
        Write-Error "Failed to check npm login status"
        return $false
    }
}

# Check if git working directory is clean
function Test-GitClean {
    if ($SkipGit) {
        return $true
    }
    
    Write-Info "Checking git status..."
    try {
        $status = git status --porcelain
        if ($status) {
            Write-Warning "Git working directory is not clean:"
            Write-Host $status
            $response = Read-Host "Continue anyway? (y/N)"
            if ($response -ne "y" -and $response -ne "Y") {
                return $false
            }
        } else {
            Write-Success "Git working directory is clean"
        }
        return $true
    } catch {
        Write-Warning "Git check failed (not a git repo or git not installed)"
        return $true
    }
}

# Run tests
function Invoke-Tests {
    if ($SkipTests) {
        Write-Warning "Skipping tests (--skip-tests flag)"
        return $true
    }
    
    Write-Info "Running tests..."
    Write-Host ""
    
    try {
        # Check which test directories exist
        $hasIntegrationTests = Test-Path "test/integration"
        $hasUnitTests = Test-Path "test/unit"
        
        if ($hasIntegrationTests) {
            Write-Info "Found integration tests in: test/integration"
            Write-Info "Running: npm run test:integration"
            Write-Host ""
            Write-Host "This will run:" -ForegroundColor Cyan
            Write-Host "  - Integration tests (commit, config, git-utils, e2e)" -ForegroundColor Gray
            Write-Host "  - Build step (required for integration tests)" -ForegroundColor Gray
            Write-Host ""
            
            npm run test:integration
            $testExitCode = $LASTEXITCODE
        } elseif ($hasUnitTests) {
            Write-Info "Found unit tests in: test/unit"
            Write-Info "Running: npm test"
            Write-Host ""
            
            npm test
            $testExitCode = $LASTEXITCODE
        } else {
            Write-Warning "No test directories found (test/unit or test/integration)"
            Write-Warning "Skipping tests..."
            return $true
        }
        
        Write-Host ""
        
        if ($testExitCode -ne 0) {
            Write-Error "Tests completed with failures (exit code: $testExitCode)"
            Write-Host ""
            Write-Warning "Some tests failed. This could indicate issues with:"
            Write-Host "  - Test configuration" -ForegroundColor Gray
            Write-Host "  - Missing dependencies or setup" -ForegroundColor Gray
            Write-Host "  - Actual code issues" -ForegroundColor Gray
            Write-Host ""
            Write-Warning "Review the test output above for details."
            Write-Host ""
            $response = Read-Host "Continue with publish despite test failures? (y/N)"
            if ($response -ne "y" -and $response -ne "Y") {
                Write-Info "Publishing cancelled due to test failures"
                return $false
            }
            Write-Warning "Proceeding with publish despite test failures..."
        } else {
            Write-Success "All tests passed!"
        }
        return $true
    } catch {
        Write-Error "Failed to run tests: $_"
        Write-Host ""
        $response = Read-Host "Continue with publish anyway? (y/N)"
        if ($response -ne "y" -and $response -ne "Y") {
            return $false
        }
        return $true
    }
}

# Build the project
function Invoke-Build {
    Write-Info "Building project..."
    try {
        npm run build
        if ($LASTEXITCODE -ne 0) {
            Write-Error "Build failed!"
            return $false
        }
        
        if (-not (Test-Path "out/cli.cjs")) {
            Write-Error "Build output not found: out/cli.cjs"
            return $false
        }
        
        Write-Success "Build completed successfully!"
        return $true
    } catch {
        Write-Error "Build failed: $_"
        return $false
    }
}

# Increment version by incrementing the last digit (patch version)
function Update-Version {
    $currentVersion = Get-CurrentVersion
    Write-Info "Current version: $currentVersion"
    
    $newVersion = Increment-PatchVersion -Version $currentVersion
    if (-not $newVersion) {
        return $false
    }
    
    Write-Info "Incrementing patch version: $currentVersion -> $newVersion"
    
    if (-not (Set-PackageVersion -NewVersion $newVersion)) {
        return $false
    }
    
    Write-Success "Version updated: $currentVersion -> $newVersion"
    return $true
}

# Show what will be published
function Show-DryRun {
    Write-Info "Running dry-run to see what will be published..."
    Write-Host ""
    npm publish --dry-run
    Write-Host ""
}

# Publish to npm
function Publish-Npm {
    Write-Info "Publishing to npm..."
    try {
        npm publish
        if ($LASTEXITCODE -ne 0) {
            Write-Error "Publish failed!"
            return $false
        }
        Write-Success "Published successfully!"
        return $true
    } catch {
        Write-Error "Publish failed: $_"
        return $false
    }
}

# Create git tag and push
function Invoke-GitTag {
    if ($SkipGit) {
        return $true
    }
    
    $version = Get-CurrentVersion
    $tag = "v$version"
    
    Write-Info "Creating git tag: $tag"
    try {
        # Check if tag already exists
        $existingTag = git tag -l $tag
        if ($existingTag) {
            Write-Warning "Tag $tag already exists"
            $response = Read-Host "Continue without creating tag? (Y/n)"
            if ($response -eq "n" -or $response -eq "N") {
                return $false
            }
            return $true
        }
        
        git add package.json
        git commit -m "chore: bump version to $version" 2>&1 | Out-Null
        git tag $tag
        Write-Success "Created tag: $tag"
        
        $response = Read-Host "Push to remote? (Y/n)"
        if ($response -ne "n" -and $response -ne "N") {
            git push
            git push --tags
            Write-Success "Pushed to remote"
        }
        return $true
    } catch {
        Write-Warning "Git tag operation failed (not a git repo or git not installed)"
        return $true
    }
}

# Main execution
function Main {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "  Alcapush NPM Publishing Script" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    
    # Pre-flight checks
    if (-not (Test-NpmLogin)) {
        exit 1
    }
    
    if (-not (Test-GitClean)) {
        exit 1
    }
    
    # Version bump
    if (-not (Update-Version)) {
        exit 1
    }
    
    $currentVersion = Get-CurrentVersion
    Write-Host ""
    Write-Info "Publishing version: $currentVersion"
    Write-Host ""
    
    # Run tests
    if (-not (Invoke-Tests)) {
        exit 1
    }
    
    # Build
    if (-not (Invoke-Build)) {
        exit 1
    }
    
    # Dry run
    Show-DryRun
    
    if ($DryRun) {
        Write-Success "Dry-run completed. Use without --dry-run to actually publish."
        exit 0
    }
    
    # Confirm before publishing
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Yellow
    Write-Host "  PUBLISH CONFIRMATION" -ForegroundColor Yellow
    Write-Host "========================================" -ForegroundColor Yellow
    Write-Host ""
    Write-Info "Package Name: alcapush"
    Write-Info "Version: $currentVersion"
    Write-Info "Registry: npm (https://www.npmjs.com)"
    Write-Host ""
    Write-Warning "This will publish alcapush@$currentVersion to the public npm registry."
    Write-Warning "This action cannot be easily undone!"
    Write-Host ""
    Write-Host "Press 'y' or 'Y' to confirm and publish, or any other key to cancel."
    Write-Host ""
    $confirm = Read-Host "Publish alcapush@$currentVersion to npm? (y/N)"
    Write-Host ""
    
    if ($confirm -ne "y" -and $confirm -ne "Y") {
        Write-Info "Publishing cancelled by user"
        exit 0
    }
    
    Write-Info "Confirmation received. Proceeding with publish..."
    Write-Host ""
    
    # Publish
    if (-not (Publish-Npm)) {
        exit 1
    }
    
    # Git tag
    if (-not (Invoke-GitTag)) {
        Write-Warning "Publish succeeded but git tag failed"
    }
    
    Write-Host ""
    Write-Success "========================================"
    Write-Success "  Publishing completed successfully!"
    Write-Success "========================================"
    Write-Host ""
    Write-Info "Package: alcapush@$currentVersion"
    Write-Info "Install: npm install -g alcapush"
    Write-Host ""
}

# Run main function
Main

