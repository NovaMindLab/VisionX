# 01 - 串口通信与协议架构实现

本文档详细记录控制台中 **ESP32 串口底层通信、热插拔探测与日志终端** 的实现机制与关键设计。

---

## 一、ESP32-S3 原生 USB CDC 硬件特性

* **芯片原生控制器**：Seeed Studio XIAO ESP32-S3 采用内置的 `USB-Serial/JTAG` 控制器（原生全速 USB 12Mbps），而非外置 CP2102 或 CH340 桥接芯片。
* **硬件标识**：
  * Vendor ID (VID): `0x303A` (Espressif)
  * Product ID (PID): `0x1001`
  * 自动设备识别名：`Seeed Studio XIAO ESP32-S3 Sense`
* **DTR / RTS 信号线强制使能**：  
  在 Node.js `serialport` 中，原生 USB CDC 必须显式开启 `dtr: true, rts: true`，否则芯片端可能无法触发串口握手甚至不输出串口日志。

---

## 二、SerialManager 核心实现

源码文件：[`electron/managers/SerialManager.ts`](file:///d:/AI_serach_image/VisionX/eproject/electron/managers/SerialManager.ts)

### 1. 端口自动扫描与精准识别
```typescript
const ports = await SerialPort.list();
// 自动匹配 VID 303A 或厂家字符串包含 Espressif / Seeed
const isEsp32 = vid === '303a' || manufacturer.includes('espressif') || manufacturer.includes('seeed');
```

### 2. USB 设备热插拔监听引擎
* 建立 1500ms 高效轮询定时器，记录上一次检测到的系统端口快照集合；
* 探测新增端口时：自动发射 `port-added` 事件，若为当前目标芯片则自动提示重连；
* 探测拔出端口时：若当前处于活跃连接状态，立即安全关闭并触发 `port-removed` 提示。

### 3. 数据流缓冲切分与防内存泄漏
* 采用 `this.rxBuffer` 汇聚底层分片二进制块；
* 每次接收到数据按 `\r?\n` 进行安全正则切分，未结束片段保留在行缓冲区中；
* 严格解耦**文本日志**与**多媒体大二进制包**（单张照片 `IMG_START` 与视频流 `FRAME_START` 单独汇聚，不输出到控制台文本流）。

---

## 三、Vue 3 串口调试终端 (SerialView)

源码文件：[`src/views/SerialView.vue`](file:///d:/AI_serach_image/VisionX/eproject/src/views/SerialView.vue)

* **2000 行环形限额缓存 (FIFO)**：防止 ESP32 打印海量调试信息导致 Electron 渲染层 DOM 节点激增卡死；
* **五维日志等级过滤**：支持一键筛选 `ALL` / `INFO` / `WARN` / `ERROR` / `TX`；
* **动态搜索与关键词高亮**：快速锁定核心报错与自检回包；
* **运行控制**：
  * 锁定滚动 (Lock Scroll)
  * 暂停输出 (Pause)
  * 一键复制全部日志 (Copy)
  * 导出为本地 `.txt` / `.log` 文件 (Export)
  * 一键清屏 (Clear)
* **快捷指令面板**：预置 `PING`、`GET_DEVICE_INFO`、`STATUS`、`📷 拍照`、`⚠️ 重启 ESP32`。
