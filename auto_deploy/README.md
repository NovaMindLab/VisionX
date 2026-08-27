# 🚀 VisionX 自动编译与 GitHub 发布工具包 (auto_deploy)

本目录提供针对 **VisionX Smart Glass Debug Console** 的一键式构建、打包与 GitHub Release 自动发布系统。

---

## 🛠️ 自动化流程说明

运行脚本后，系统会自动完成以下工作：
1. **环境自检**：检测 Node.js、Git、GitHub CLI (`gh.exe`) 及登录鉴权状态；
2. **源码编译**：自动执行 Vite 构建 Vue 3 前端及 esbuild 编译 Electron 主进程；
3. **Windows 封装**：调用 `electron-builder` 封装生成标准的 Windows 安装包 (`-Setup.exe`) 和免安装便携版 (`.exe`)；
4. **云端发布**：自动创建 Git Tag、生成格式化发布日志，并将 `.exe` 资源通过安全通道推送到 GitHub Releases。

---

## ⚡ 快速使用方法

### 方式 1：双击运行（最简单）
在 Windows 资源管理器中，直接双击运行：
```text
auto_deploy\deploy.bat
```

### 方式 2：PowerShell 终端命令行运行
```powershell
# 1. 进入 auto_deploy 目录
cd d:\AI_serach_image\VisionX\auto_deploy

# 2. 默认发布 (读取 package.json 默认版本号)
.\deploy.ps1

# 3. 指定版本号与标题发布
.\deploy.ps1 -Version "1.0.1" -Title "VisionX 视频与拍照联调正式版"

# 4. 发布为草稿 (Draft) 或预发布 (Pre-release)
.\deploy.ps1 -Draft
.\deploy.ps1 -Prerelease

# 5. 如果已经构建过 exe，仅需上传到 GitHub
.\deploy.ps1 -SkipBuild
```

---

## 📋 环境准备要求

1. **GitHub CLI (`gh.exe`)**：
   * 本机已安装 `gh.exe` 并完成登录授权 (`gh auth login`)；
   * 确保登录账号具备当前仓库（`NovaMindLab/VisionX`）的写入权限。
2. **Node.js 环境**：
   * Node.js >= 20.0，并在 `eproject/` 目录下完成 `npm install`。

---

## 📦 输出产物

发布成功后，可直接在 GitHub 仓库 Release 页面查看：  
🔗 **[https://github.com/NovaMindLab/VisionX/releases](https://github.com/NovaMindLab/VisionX/releases)**

* `VisionX-SmartGlass-Console-Setup-<version>.exe` —— Windows 标准向导安装程序
* `VisionX-SmartGlass-Console-<version>.exe` —— Windows 独立便携免安装版
