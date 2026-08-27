<#
.SYNOPSIS
    VisionX 智能眼镜控制台 Windows EXE 自动编译并发布至 GitHub Releases 脚本

.DESCRIPTION
    本脚本自动执行以下全流程：
    1. 检查本地环境依赖 (Node.js, Git, GitHub CLI gh)
    2. 编译 Vue 3 前端与 Electron 主进程
    3. 打包生成独立的 Windows 安装包与便携版 (.exe)
    4. 自动创建 Git Tag 并通过 GitHub CLI 上传 .exe 资源到 GitHub Release
    5. 生成带有发布日志的 Release 说明及下载链接

.EXAMPLE
    .\deploy.ps1
    .\deploy.ps1 -Version "1.0.1" -Title "VisionX 视频与拍照联调版"
    .\deploy.ps1 -Draft
#>

[CmdletBinding()]
param (
    [string]$Version = "",
    [string]$Title = "",
    [string]$Notes = "",
    [switch]$Draft,
    [switch]$Prerelease,
    [switch]$SkipBuild
)

$ErrorActionPreference = "Stop"

# 项目根目录与 eproject 路径定义
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RootDir = Split-Path -Parent $ScriptDir
$EprojectDir = Join-Path $RootDir "eproject"
$PackageJsonPath = Join-Path $EprojectDir "package.json"

Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  🚀 VisionX Smart Glass Debug Console 自动化发布引擎" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

# 1. 读取 package.json 版本号
if (-not (Test-Path $PackageJsonPath)) {
    Write-Error "找不到 eproject/package.json，请确认项目结构！"
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

Write-Host "  - 目标版本: $Tag" -ForegroundColor Green
Write-Host "  - 发布标题: $Title" -ForegroundColor Green
Write-Host "----------------------------------------------------------------" -ForegroundColor Gray

# 2. 检查依赖工具
Write-Host "[1/5] 检查系统环境与授权..." -ForegroundColor Yellow

# 检查 gh
if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
    Write-Error "未检测到 GitHub CLI (gh.exe)！请先安装：winget install GitHub.cli 或访问 https://cli.github.com"
    exit 1
}

# 检查 gh 登录状态
$authCheck = gh auth status 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Error "GitHub CLI 未登录！请在终端运行: gh auth login 进行登录授权。"
    exit 1
}
Write-Host "  ✓ GitHub CLI 认证状态正常" -ForegroundColor Green

# 检查 git
if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    Write-Error "未检测到 Git！"
    exit 1
}

# 3. 执行编译与打包
$ReleaseDir = Join-Path $EprojectDir "release"

if (-not $SkipBuild) {
    Write-Host "[2/5] 编译前端与 Electron 主进程..." -ForegroundColor Yellow
    Push-Location $EprojectDir
    try {
        npm run build
        if ($LASTEXITCODE -ne 0) { throw "npm run build 失败" }
        Write-Host "  ✓ 编译成功 (dist/ & dist-electron/)" -ForegroundColor Green

        Write-Host "[3/5] 打包生成 Windows EXE 应用程序 (electron-builder)..." -ForegroundColor Yellow
        npx electron-builder --win --x64
        if ($LASTEXITCODE -ne 0) { throw "electron-builder 打包失败" }
        Write-Host "  ✓ 打包成功！产物输出目录: $ReleaseDir" -ForegroundColor Green
    }
    finally {
        Pop-Location
    }
} else {
    Write-Host "[2/5] & [3/5] 跳过构建步骤 (-SkipBuild 模式)" -ForegroundColor DarkGray
}

# 4. 检索生成的 EXE 文件
Write-Host "[4/5] 检索发布文件..." -ForegroundColor Yellow
if (-not (Test-Path $ReleaseDir)) {
    Write-Error "未找到打包目录: $ReleaseDir"
    exit 1
}

$ExeFiles = Get-ChildItem -Path $ReleaseDir -Filter "*.exe" -File
if ($ExeFiles.Count -eq 0) {
    Write-Error "在 $ReleaseDir 中未找到任何 .exe 文件！"
    exit 1
}

Write-Host "  找到准备发布的二进制文件:" -ForegroundColor Cyan
foreach ($f in $ExeFiles) {
    $sizeMB = [math]::Round($f.Length / 1MB, 2)
    Write-Host "    📦 $($f.Name) ($sizeMB MB)" -ForegroundColor White
}

# 5. 准备 Release Notes
if ([string]::IsNullOrWhiteSpace($Notes)) {
    $CommitHash = (git rev-parse --short HEAD).Trim()
    $BuildDate = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
    $Notes = @"
## 👓 VisionX 智能眼镜调试控制台 ($Tag)

本版本为基于 Seeed Studio XIAO ESP32-S3 Sense 打造的开源智能眼镜 PC 联调控制台。

### ✨ 核心功能
* **⚡ 极速串口管理**：一键自动识别 ESP32-S3 原生 USB CDC (COM)，支持热插拔自动重连。
* **📷 高清抓拍展示**：点击拍照，ESP32 抓取 OV2640 画面并在 PC 屏幕实时展示与保存。
* **🔴 实时视频流采集**：支持 QVGA / VGA 实时连续视频预览 (12~18 FPS)，实时显示 FPS 与传输码率。
* **🧪 硬件健康诊断**：一键自检摄像头、麦克风、OPI PSRAM 与连接状态。

### 📦 安装与运行
* **安装版**：下载 \`VisionX-SmartGlass-Console-Setup-$Version.exe\` 直接安装。
* **免安装便携版**：下载 \`VisionX-SmartGlass-Console-$Version.exe\` 双击直接运行。

---
*构建提交: \`$CommitHash\` | 发布时间: \`$BuildDate\`*
"@
}

$TempNotesFile = [System.IO.Path]::GetTempFileName()
[System.IO.File]::WriteAllText($TempNotesFile, $Notes, [System.Text.Encoding]::UTF8)

# 6. 发布到 GitHub
Write-Host "[5/5] 正在发布到 GitHub Releases..." -ForegroundColor Yellow

$ghArgs = @("release", "create", $Tag)
foreach ($f in $ExeFiles) {
    $ghArgs += $f.FullName
}
$ghArgs += @("--title", $Title, "--notes-file", $TempNotesFile)

if ($Draft) {
    $ghArgs += "--draft"
}
if ($Prerelease) {
    $ghArgs += "--prerelease"
}

# 检查当前 tag 是否已存在，如果存在则覆盖上传资源
$existingRelease = gh release view $Tag 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "  检测到已存在 Release $Tag，正在更新上传新编译的资源..." -ForegroundColor Yellow
    foreach ($f in $ExeFiles) {
        gh release upload $Tag $f.FullName --clobber
    }
} else {
    Push-Location $RootDir
    try {
        & gh @ghArgs
        if ($LASTEXITCODE -ne 0) {
            throw "GitHub Release 发布失败！"
        }
    }
    finally {
        Pop-Location
    }
}

Remove-Item $TempNotesFile -ErrorAction SilentlyContinue

Write-Host "================================================================" -ForegroundColor Green
Write-Host "  🎉 自动化发布圆满完成！" -ForegroundColor Green
Write-Host "  🔗 查看与下载 Release:" -ForegroundColor Cyan
Write-Host "     https://github.com/NovaMindLab/VisionX/releases/tag/$Tag" -ForegroundColor White
Write-Host "================================================================" -ForegroundColor Green
