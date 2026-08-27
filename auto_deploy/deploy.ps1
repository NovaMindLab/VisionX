param (
    [string]$Version = "",
    [string]$Title = "",
    [string]$Notes = "",
    [switch]$Draft,
    [switch]$Prerelease,
    [switch]$SkipBuild
)

$ErrorActionPreference = "Stop"

# Paths
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RootDir = Split-Path -Parent $ScriptDir
$EprojectDir = Join-Path $RootDir "eproject"
$PackageJsonPath = Join-Path $EprojectDir "package.json"

Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  VisionX Smart Glass Debug Console Auto Deploy Engine" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

# 1. Read version from package.json
if (-not (Test-Path $PackageJsonPath)) {
    Write-Error "Cannot find eproject/package.json!"
    exit 1
}

$pkg = Get-Content $PackageJsonPath -Raw | ConvertFrom-Json
if ([string]::IsNullOrWhiteSpace($Version)) {
    $Version = $pkg.version
}
$Tag = "v$Version"

if ([string]::IsNullOrWhiteSpace($Title)) {
    $Title = "VisionX Smart Glass Debug Console $Tag"
}

Write-Host "Target Version: $Tag" -ForegroundColor Green
Write-Host "Release Title : $Title" -ForegroundColor Green
Write-Host "----------------------------------------------------------------" -ForegroundColor Gray

# 2. Check prerequisites
Write-Host "[1/5] Checking environment..." -ForegroundColor Yellow

if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
    Write-Error "GitHub CLI (gh.exe) is not installed! Please install via winget install GitHub.cli"
    exit 1
}

# Check gh auth
$authCheck = gh auth status 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Error "GitHub CLI is not logged in! Please run 'gh auth login' first."
    exit 1
}
Write-Host "  [OK] GitHub CLI authenticated" -ForegroundColor Green

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    Write-Error "Git is not installed!"
    exit 1
}

# 3. Build & Package
$ReleaseDir = Join-Path $EprojectDir "release"

if (-not $SkipBuild) {
    Write-Host "[2/5] Building frontend and Electron..." -ForegroundColor Yellow
    Push-Location $EprojectDir
    try {
        npm run build
        if ($LASTEXITCODE -ne 0) { throw "npm run build failed" }
        Write-Host "  [OK] Build complete" -ForegroundColor Green

        Write-Host "[3/5] Packaging Windows EXE with electron-builder..." -ForegroundColor Yellow
        npx electron-builder --win --x64
        if ($LASTEXITCODE -ne 0) { throw "electron-builder packaging failed" }
        Write-Host "  [OK] Packaging complete" -ForegroundColor Green
    }
    finally {
        Pop-Location
    }
} else {
    Write-Host "[2/5] & [3/5] Skipping build (-SkipBuild specified)" -ForegroundColor DarkGray
}

# 4. Find generated EXE files
Write-Host "[4/5] Locating release binaries..." -ForegroundColor Yellow
if (-not (Test-Path $ReleaseDir)) {
    Write-Error "Release directory not found: $ReleaseDir"
    exit 1
}

$ReleaseFiles = Get-ChildItem -Path $ReleaseDir -File | Where-Object {
    $_.Extension -eq ".exe" -or $_.Extension -eq ".blockmap" -or $_.Name -eq "latest.yml"
}
if ($ReleaseFiles.Count -eq 0) {
    Write-Error "No release files found in $ReleaseDir!"
    exit 1
}

Write-Host "Found files to release (including differential blockmap & manifests):" -ForegroundColor Cyan
foreach ($f in $ReleaseFiles) {
    $sizeMB = [math]::Round($f.Length / 1MB, 2)
    Write-Host "  - $($f.Name) ($sizeMB MB)" -ForegroundColor White
}

# 5. Prepare Release Notes
if ([string]::IsNullOrWhiteSpace($Notes)) {
    $CommitHash = (git rev-parse --short HEAD).Trim()
    $BuildDate = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
    $Notes = @"
## VisionX Smart Glass Debug Console ($Tag)

Open-source AI smart glasses PC debug console for Seeed Studio XIAO ESP32-S3 Sense.

### Features
* USB CDC Serial connection with auto-reconnect
* OV2640 High resolution photo capture and display
* Live video streaming (QVGA 320x240 @ 12-18 FPS) with real-time FPS & bitrate stats
* Differential auto-update support (Delta blockmap)
* Hardware diagnostics (Camera, Mic, OPI PSRAM)

### Download & Run
* **Installer**: Download `VisionX-SmartGlass-Console Setup $Version.exe`
* **Portable**: Download `VisionX-SmartGlass-Console $Version.exe` (no install required)

Commit: $CommitHash | Date: $BuildDate
"@
}

$TempNotesFile = [System.IO.Path]::GetTempFileName()
[System.IO.File]::WriteAllText($TempNotesFile, $Notes, [System.Text.Encoding]::UTF8)

# 6. Publish to GitHub Releases
Write-Host "[5/5] Publishing to GitHub Releases..." -ForegroundColor Yellow

$ghArgs = @("release", "create", $Tag)
foreach ($f in $ReleaseFiles) {
    $ghArgs += $f.FullName
}
$ghArgs += @("--title", $Title, "--notes-file", $TempNotesFile)

if ($Draft) {
    $ghArgs += "--draft"
}
if ($Prerelease) {
    $ghArgs += "--prerelease"
}

# Check if release exists
$existingCheck = gh release view $Tag 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "Release $Tag already exists. Uploading new binaries..." -ForegroundColor Yellow
    foreach ($f in $ReleaseFiles) {
        gh release upload $Tag $f.FullName --clobber
    }
} else {
    Push-Location $RootDir
    try {
        & gh @ghArgs
        if ($LASTEXITCODE -ne 0) {
            throw "GitHub release creation failed"
        }
    }
    finally {
        Pop-Location
    }
}

Remove-Item $TempNotesFile -ErrorAction SilentlyContinue

Write-Host "================================================================" -ForegroundColor Green
Write-Host "  SUCCESS! Release published to GitHub." -ForegroundColor Green
Write-Host "  View Release URL:" -ForegroundColor Cyan
Write-Host "  https://github.com/NovaMindLab/VisionX/releases/tag/$Tag" -ForegroundColor White
Write-Host "================================================================" -ForegroundColor Green
