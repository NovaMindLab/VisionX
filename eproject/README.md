# Smart Glass Debug Console (智能眼镜硬件联调控制台)

基于 **Electron + Vue 3 + TypeScript + Vite** 开发的 Windows 桌面端智能眼镜硬件联调工具。

---

## 🌟 核心特性与实现对照

严格按照 [`eproject/wiki/readme.txt`](./wiki/readme.txt) 规范实现：

### 1. 通信架构与分层设计 (Decoupled Architecture)
```text
Electron Main Process
│
├── SerialManager       # 串口生命周期管理、波特率协商、USB 热插拔自动轮询检测
├── DeviceManager       # 统一设备状态聚合、硬件健康自检 (Hardware Test Center)
├── ProtocolManager     # 指令帧封装 (CRLF / JSON) 与日志特征解析
├── CameraManager       # OV2640 摄像头联调与状态管理
├── AudioManager        # PDM 数字麦克风音频流与音量分析
└── DisplayManager      # 屏幕状态（如实标记为：未安装外接屏幕）
        │
        ├── (IPC 安全通道 / contextBridge)
        ▼
Vue 3 Renderer Process
├── SerialView          # 串口联调终端 (带 2000 行限制防内存溢出、过滤/搜索/导出)
├── StatusView          # 统一设备状态面板 (ESP32/Camera/Mic/Display/WiFi/BLE)
├── HardwareTestView    # 硬件一键自动化测试中心
├── CameraView          # 摄像头实时预览与拍照
└── AudioView           # 麦克风实时电平与波形动效
```

### 2. 第一阶段：ESP32 串口联调全功能
*   **智能识别**：自动通过 VID `303A` / PID `1001` 识别 **Seeed Studio XIAO ESP32-S3 Sense** 并优先选中；
*   **热插拔感知**：内置后台端口轮询监听，USB 插拔自动通知前端刷新端口列表，物理断开时安全关闭连接；
*   **内存防爆机制**：日志严格维护最大 **2000 行** FIFO 环形缓冲区，避免长时间高频串口吞吐导致 Electron 内存泄漏；
*   **高效工具栏**：支持实时全文搜索高亮、日志等级分类 (`INFO`/`WARN`/`ERROR`/`DEBUG`/`TX`)、锁定/自由滚动切换、流式暂停、一键复制与本地文本导出。

### 3. 第二阶段：真实硬件状态面板 (Device Status)
*   **诚实反馈**：由于确认未安装显示屏，屏幕模块明确标示为 `○ Not Installed`，杜绝伪造状态；
*   **微型传感器归属**：明确标识板载 **OV2640 DVP 模组** 与 **PDM 麦克风**（GPIO 41/42）。

### 4. 第三阶段：硬件自动化测试中心 (Hardware Test)
*   提供一键单项测试 `[ Test ]` 与 `[ 一键全检所有硬件 ]`；
*   实时向 ESP32 发生自检握手，输出带时间戳的详细检测日志。

---

## 🚀 启动与构建指南

### 本地开发与启动
```bash
cd eproject

# 1. 编译并启动桌面控制台
npm start
```

### 单独编译
```bash
# 编译 Vue 渲染层
npm run build:vue

# 编译 Electron 主进程与 Preload
npm run build:electron

# 全量构建
npm run build
```
