# 05 - Blockmap 差分增量升级体系

本文档详细记录控制台如何基于 `electron-updater` 与 GitHub Releases 实现**极速差分增量升级**（仅需下载变动数据块，无需下载 88MB 全量包）。

---

## 一、差分增量升级核心原理 (Blockmap)

在默认情况下，每次 Electron 升级都需要用户下载完整的安装包（约 88MB），极其浪费流量和时间。

我们在项目中启用了 `electron-builder` 的 **Blockmap 差分算法**：
1. **切片哈希**：打包生成 NSIS 安装包时，工具链同时生成一个 `.exe.blockmap` 索引文件；
2. **块级指纹**：该文件记录了整个安装包被切分为无数个 **64KB 数据块**后的 SHA-256 哈希值；
3. **差异比对**：当老版本客户端检测到新版本时，先下载新版本的 `latest.yml` 与 `.blockmap`，与本地安装文件的块哈希进行比对；
4. **HTTP Range 增量拉取**：客户端**仅向服务器请求那些哈希发生改变的 64KB 块**；
5. **实际效果**：一次典型的日常功能更新或 bug 修复，用户**只需下载 2MB ~ 5MB 的变动数据**，几秒钟即可完成升级！

---

## 二、关键代码实现

### 1. 配置 `package.json`
```json
"publish": [
  {
    "provider": "github",
    "owner": "NovaMindLab",
    "repo": "VisionX"
  }
],
"nsis": {
  "oneClick": false,
  "allowToChangeInstallationDirectory": true,
  "differentialPackage": true
}
```

### 2. 后端管理器 (`electron/managers/UpdateManager.ts`)
* **生命周期解耦**：
  * `autoUpdater.autoDownload = false`（不搞流氓静默下载，必须经由用户知情确认）；
  * 监听 `update-available`、`download-progress`、`update-downloaded` 并通过 IPC 广播给前端；
* **启动静默探测**：
  * 窗口加载后延迟 2.5 秒触发一次 `checkForUpdates()`，不抢占首屏启动资源；
* **极速安装**：
  * 下载完毕调用 `autoUpdater.quitAndInstall(false, true)`，应用退出、静默覆盖替换、自动重新拉起新版。

### 3. 前端交互组件 (`src/components/UpdateModal.vue`)
* 顶部醒目的 **`当前版本 ➔ 最新版本`** 迁移指示徽章；
* 渲染 GitHub Release Notes 更新说明；
* 实时展示下载百分比与实时下载速度（MB/s）；
* 下载完成后按钮高亮为 **`✨ 立即重启并完成安装`**；
* 顶部导航栏提供 **`[ 🚀 检查更新 ]`** 手动自检入口。

### 4. 本地开发调试配置 (`dev-app-update.yml`)
在未打包的开发模式下（`npm start`），`electron-updater` 会读取根目录下的 `dev-app-update.yml`，使得本地开发时也能无缝模拟连接 GitHub 进行版本自检。

---

## 三、下一版本发布与差分更新实测流程

当您后续修改了代码想推送新版本时：
1. 打开 `eproject/package.json`，修改版本号（如 `1.0.2`）；
2. 运行 `auto_deploy/deploy.bat`；
3. 发布成功后，所有处于 `1.0.1` 版本的用户启动软件时，便会自动弹窗提示发现 `v1.0.2`；
4. 用户点击【立即差分升级】，后台只拉取几兆的改动数据，秒级更新完毕！
