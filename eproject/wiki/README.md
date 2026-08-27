# 👓 Smart Glass Debug Console (eproject) 开发与实现 Wiki

> 本 Wiki 汇总记录了 **VisionX / eproject**（基于 Electron + Vue 3 + TypeScript 的智能眼镜 PC 联调控制台）的完整系统架构、通信协议、功能实现、体积优化与自动化发布等所有修改。

---

## 📌 项目定位与架构总览

Smart Glass Debug Console 是专门针对 **Seeed Studio XIAO ESP32-S3 Sense** 智能眼镜硬件打造的独立 PC 上位机联调系统。

```
+-----------------------------------------------------------------------------------+
|                     Smart Glass Debug Console (Electron + Vue 3)                 |
+-----------------------------------------------------------------------------------+
|  [ 渲染层 (Vue 3 + TS) ]                                                          |
|   ├── SerialView      (串口日志终端，2000行环形缓冲，搜索高亮，指令交互)             |
|   ├── CameraView      (单张抓拍大图预览 + 15 FPS 实时视频流播放器 + 实测指标)         |
|   ├── StatusView      (硬件综合健康状态监控面板)                                    |
|   ├── HardwareTest    (一键硬件自动化自检中心)                                      |
|   ├── AudioView       (板载 PDM 麦克风录音与声波示波器 - 规划中)                     |
|   └── UpdateModal     (Blockmap 差分极速增量升级弹窗)                              |
+-----------------------------------------------------------------------------------+
|  [ IPC 隔离桥接层 (Preload.ts) - contextBridge.exposeInMainWorld ]                |
+-----------------------------------------------------------------------------------+
|  [ 主进程管理层 (Node.js + TS) ]                                                  |
|   ├── SerialManager   (串口生命周期、热插拔探测、流式协议分发)                       |
|   ├── CameraManager   (摄像头启停与状态追踪)                                        |
|   ├── UpdateManager   (electron-updater 差分更新状态机与安装重启)                   |
|   ├── DeviceManager   (设备状态汇聚与硬件测试套件)                                  |
|   └── ProtocolManager (指令组装、行切分与 JSON 解析)                               |
+-----------------------------------------------------------------------------------+
                                    │ (USB CDC @ 115200 / 460800 bps)
                                    ▼
                [ Seeed Studio XIAO ESP32-S3 Sense 智能眼镜终端 ]
```

---

## 📚 知识库目录导航

| 章节 | 文档名称 | 核心内容 |
| :--- | :--- | :--- |
| **01** | [串口通信与协议架构](./01-serial-communication.md) | USB CDC 自动探测、热插拔重连、DTR/RTS 流控、2000行日志缓存 |
| **02** | [摄像头拍照与实时视频流](./02-camera-and-video-streaming.md) | OV2640 驱动、全局成片持久化、定界符流式解析引擎、15 FPS 实时视频流、硬件 FIFO 刷新 |
| **03** | [安装包体积精简优化](./03-package-optimization-and-locales.md) | 语言包裁剪 (减少 45MB)、UPX 加壳风险剖析、行业标准实践 |
| **04** | [自动化构建发布与 CI/CD](./04-auto-deploy-and-cicd.md) | `auto_deploy` 一键发布脚本、GitHub CLI 对接、GitHub Actions 流水线 |
| **05** | [Blockmap 差分增量升级体系](./05-differential-update-guide.md) | 增量数据块拉取、启动自检弹窗、产物命名规范与 404 避坑指南 |
| **06** | [功能规划与迭代 TODO 清单](./06-future-feature-roadmap.md) | 多模态 AI 识图、PDM 麦克风示波器、相机调参台、无线图传规划 |

---

## 🛠️ 快速上手与常用指令

在 `eproject` 目录下：

```bash
# 1. 安装依赖
npm install

# 2. 启动前端 Vite 热更新
npm run dev:vue

# 3. 完整构建前端与 Electron 主进程
npm run build

# 4. 启动 Electron 桌面调试应用
npm start

# 5. 打包生成 Windows 安装包与便携版 (.exe)
npm run pack:win
```
