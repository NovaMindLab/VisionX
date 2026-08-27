# 04 - 自动化构建发布与 CI/CD 流水线

本文档详细说明如何使用项目自带的 **Auto Deploy 引擎** 以及 GitHub Actions 实现一键打包、云端发布。

---

## 一、本地自动化部署系统 (`auto_deploy/`)

为了杜绝手动打包后漫长的人工上传与容易遗漏差分配置的问题，我们在根目录下建立了自动化部署系统：

```
auto_deploy/
├── deploy.ps1       # 核心自动化 PowerShell 脚本
├── deploy.bat       # Windows 双击运行启动器
└── README.md        # 完整操作与参数手册
```

### 1. 核心流程五步曲
1. **环境自检**：检测 Node.js、npm 以及 GitHub CLI (`gh.exe`) 登录授权状态；
2. **前端与主进程构建**：一键执行 `npm run build`（Vite + esbuild）；
3. **安装包生成**：执行 `electron-builder` 生成便携版与 NSIS 安装包；
4. **差分资产搜集**：不仅匹配 `.exe`，同时搜集 `.blockmap` 块映射表与 `latest.yml` 版本清单；
5. **极速推送到 GitHub Releases**：调用 GitHub API 自动创建 Tag 并上传全部资产，附带标准化 Release Notes。

### 2. 日常发布快捷命令
```powershell
# 1. 正常全自动打包发布（自动读取 package.json 版本号）
.\auto_deploy\deploy.ps1

# 2. 发布草稿或预发布版本测试
.\auto_deploy\deploy.ps1 -Draft
.\auto_deploy\deploy.ps1 -Prerelease

# 3. 已经打包完毕，仅重新上传资源到 GitHub
.\auto_deploy\deploy.ps1 -SkipBuild
```

---

## 二、云端 CI/CD 流水线 (GitHub Actions)

配置文件：[`.github/workflows/release.yml`](file:///d:/AI_serach_image/VisionX/.github/workflows/release.yml)

### 触发机制
只要向 GitHub 推送版本 Tag，云端纯净 Windows 虚拟机将自动接管构建并发布 Release：
```bash
git tag v1.0.2
git push origin v1.0.2
```

### 工作流优势
* **纯净环境验证**：确保任何新贡献者或更换电脑后，代码在标准环境中 100% 可构建；
* **不占用本地 CPU**：重型 LZMA 压缩由 GitHub 服务器算力完成；
* **全球 CDN 加速**：自动挂载至 GitHub Releases 全球节点。
