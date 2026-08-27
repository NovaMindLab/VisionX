@echo off
chcp 65001 >nul
title VisionX Smart Glass Console - 自动编译与 GitHub 发布

echo ================================================================
echo    VisionX 智能眼镜控制台 一键编译并发布到 GitHub Releases
echo ================================================================
echo.

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0deploy.ps1" %*

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] 发布流程遇到错误，退出代码: %ERRORLEVEL%
    pause
    exit /b %ERRORLEVEL%
)

echo.
pause
