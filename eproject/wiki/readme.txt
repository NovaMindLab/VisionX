你现在负责为我的 ESP32 智能眼镜项目开发一个独立的 Electron 硬件联调工具。

## 一、项目目标

使用 **Electron + Vue + TypeScript** 开发 Windows 下运行的：

**Smart Glass Debug Console**

我的智能眼镜硬件已经组装完成，包括 ESP32、摄像头、麦克风、显示屏等硬件。

现在 ESP32 已经通过 USB 连接 PC。

这个 Electron 工具不仅用于查看串口日志，还要作为整个智能眼镜的 **PC 联调控制台**。

目标是实现：

```text
Smart Glass
     │
     │ USB / WiFi
     ↓
Electron Debug Console
     │
     ├── ESP32 串口
     ├── Camera
     ├── Microphone
     ├── Display
     ├── WiFi / Bluetooth
     ├── Device Status
     └── Debug Logs
```

## 二、重要原则

1. 不修改现有智能眼镜固件项目，除非联调确实需要增加通信接口。
2. Electron 调试工具独立开发。
3. 优先使用 Node.js / Electron 能力。
4. 使用 Vue + TypeScript。
5. Windows 优先。
6. ESP32 与 PC 的通信优先使用 USB 串口。
7. 后续可以扩展 WiFi 通信。
8. 不要为了实现一个简单功能引入复杂的原生模块。
9. 不要一次性做完所有功能，先建立稳定的联调框架。
10. 所有硬件功能都要设计成独立模块，方便后续扩展。

## 三、第一阶段：ESP32 串口联调

Electron 启动后自动发现 ESP32。

支持：

* COM 端口扫描
* 自动识别设备
* 连接 / 断开
* 自动检测 USB 插拔
* 115200 等常用波特率
* 实时串口日志
* 向 ESP32 发送命令

日志窗口支持：

* 自动滚动
* 暂停
* 清空
* 搜索
* 日志级别过滤
* 复制
* 导出

同时限制日志缓存数量，避免长时间运行造成 Electron 内存持续增长。

## 四、第二阶段：Camera 联调

我的 ESP32 摄像头已经安装完成。

需要根据实际 ESP32 型号和摄像头型号确定通信方式，不要假设型号。

优先实现：

```text
ESP32 Camera
      ↓
拍摄图片 / 视频流
      ↓
USB / WiFi
      ↓
Electron
      ↓
Camera Preview
```

Electron 增加 Camera 页面：

```text
┌──────────────────────────────┐
│ Camera                       │
├──────────────────────────────┤
│                              │
│        Camera Preview        │
│                              │
│                              │
├──────────────────────────────┤
│ Resolution: 640x480          │
│ FPS: 15                      │
│ [Start] [Stop] [Capture]     │
└──────────────────────────────┘
```

至少实现：

* 摄像头初始化
* 摄像头启动 / 停止
* 实时预览（硬件和链路支持时）
* 拍照
* 保存图片
* 显示分辨率
* FPS
* 数据传输状态
* 摄像头错误日志

如果 ESP32 摄像头无法直接通过 USB 提供视频流，要根据实际硬件能力选择合适方案，例如 ESP32 WiFi HTTP/MJPEG 等。

不要为了实现 PC 预览而强行改变现有硬件架构。

## 五、第三阶段：Microphone 联调

我的智能眼镜麦克风已经安装。

增加 Audio 页面：

```text
┌──────────────────────────────┐
│ Microphone                   │
├──────────────────────────────┤
│                              │
│      Audio Waveform          │
│  ───────────────────────     │
│                              │
│ Volume: ███████░░░           │
│                              │
│ [Start] [Stop] [Record]      │
└──────────────────────────────┘
```

实现：

* 麦克风初始化
* 开始 / 停止采集
* 实时音量
* 简单波形
* 录音
* 保存音频
* 采样率 / 声道 / 数据量显示

后续预留：

```text
Microphone
    ↓
Audio Buffer
    ↓
Whisper / 本地语音识别
```

## 六、第四阶段：Display 联调

如果智能眼镜显示屏由 ESP32 控制，增加 Display Test 页面。

支持根据实际硬件能力实现：

* 屏幕初始化
* 清屏
* 显示测试图
* RGB / 灰度测试
* FPS
* 分辨率
* 屏幕亮度
* 显示文字
* 显示图片

例如：

```text
Display Test

Resolution: xxx
FPS: xxx

[Color Test]
[Grid Test]
[Text Test]
[Image Test]
[Clear]

Brightness: ─────●──
```

不要假设屏幕型号，先读取/确认实际硬件。

## 七、设备状态面板

首页提供统一的设备状态：

```text
Device Status

ESP32       ● Connected
Camera      ● Ready
Microphone  ● Ready
Display     ● Ready
WiFi        ● Connected
Bluetooth   ○ Disabled
```

如果某个硬件没有检测到：

```text
Camera      ○ Not Ready
```

不要伪造状态。

## 八、硬件测试中心

增加一个 Hardware Test 页面。

用于快速检查整个眼镜：

```text
Hardware Test

ESP32        [Test]
Camera       [Test]
Microphone   [Test]
Display      [Test]
WiFi         [Test]
Bluetooth    [Test]
```

点击 Test 后自动执行对应的最小测试，并显示：

```text
✓ Camera initialization successful
✓ Capture successful
✓ Image received
```

这样以后每次修改固件后，可以直接用这个工具快速确认硬件有没有问题。

## 九、通信架构

Electron 不直接把所有硬件逻辑写在 Vue 中。

采用：

```text
Electron Main
│
├── SerialManager
│
├── DeviceManager
│
├── CameraManager
│
├── AudioManager
│
├── DisplayManager
│
└── ProtocolManager
        │
        ↓
      IPC
        │
        ↓
Vue Renderer
```

Preload 只暴露明确的 API。

例如：

```text
device.connect()
device.disconnect()

serial.write()
serial.onData()

camera.start()
camera.stop()
camera.capture()

audio.start()
audio.stop()

display.test()
display.clear()
```

具体 API 根据实际实现调整。

## 十、通信协议

不要让 Electron 依赖杂乱的字符串命令。

为后续联调设计简单、可扩展的通信协议。

例如：

```text
GET_DEVICE_INFO
CAMERA_START
CAMERA_STOP
CAMERA_CAPTURE
AUDIO_START
AUDIO_STOP
DISPLAY_TEST
DEVICE_STATUS
```

如果当前固件还没有这些命令，不要一次性大改固件。

先建立协议层，并逐步增加固件支持。

## 十一、性能要求

这个工具本身也需要考虑性能。

重点避免：

* 高频串口数据导致 Vue 大量更新
* 摄像头视频流造成 Electron 内存持续增长
* 日志无限增长
* 音频 Buffer 无限增长
* 大量 IPC 消息堆积

视频、音频和日志需要合理控制 Buffer 和生命周期。

## 十二、开发方式

严格按照实际硬件进行开发。

**第一步必须先检查：**

1. 当前项目目录
2. package.json
3. Electron / Vue / TypeScript 版本
4. ESP32 的具体型号
5. 摄像头型号
6. 麦克风型号
7. 显示屏型号
8. Windows 当前识别到的 COM 设备

如果无法自动识别硬件型号，就通过串口日志、USB 信息或让我提供硬件信息。

**不要假设硬件型号。**

确认硬件以后，再决定 Camera、Audio、Display 的具体实现方式。

## 十三、实施顺序

不要一次实现全部功能。

按照：

```text
① ESP32 USB / Serial
        ↓
② Device Status
        ↓
③ Camera
        ↓
④ Microphone
        ↓
⑤ Display
        ↓
⑥ Hardware Test
        ↓
⑦ WiFi / Bluetooth
```

逐步实施。

每完成一个模块：

1. 编译
2. 启动 Electron
3. 连接真实硬件
4. 实际测试
5. 修复问题
6. 再进入下一个模块

最终目标不是一个模拟界面，而是一个**可以直接连接我的智能眼镜进行真实硬件联调的 Electron 工具**。

### 现在开始

先不要写大量代码。

第一步先检查当前项目和 Windows 环境，并识别：

**Electron 项目环境 + ESP32 型号 + COM 端口 + Camera + Microphone + Display。**

确认这些信息后，再开始实现第一阶段的 ESP32 串口通信。
