# 02 - 摄像头拍照与实时视频流系统

本文档详细记录控制台与固件在 **OV2640 摄像头拍照、Base64 传输流与实时视频连续采集** 的实现细节。

---

## 一、硬件与驱动底座 (ESP32-S3 + OV2640)

* **摄像头芯片**：OmniVision OV2640 (DVP 8-bit 并口模式)
* **内存配置**：必须开启 **OPI PSRAM** (八线高速 PSRAM，80MHz，8MB 容量)
* **驱动引脚定义 (Seeed XIAO Sense)**：
  ```cpp
  #define XCLK_GPIO_NUM     10
  #define SIOD_GPIO_NUM     40
  #define SIOC_GPIO_NUM     39
  #define Y9_GPIO_NUM       48
  #define Y8_GPIO_NUM       11
  #define Y7_GPIO_NUM       12
  #define Y6_GPIO_NUM       14
  #define Y5_GPIO_NUM       16
  #define Y4_GPIO_NUM       18
  #define Y3_GPIO_NUM       17
  #define Y2_GPIO_NUM       15
  #define VSYNC_GPIO_NUM    38
  #define HREF_GPIO_NUM     47
  #define PCLK_GPIO_NUM     13
  ```
* **帧缓冲策略**：`fb_count = 2` (双缓冲硬件 DMA 自动捕获)，`fb_location = CAMERA_FB_IN_PSRAM`。

---

## 二、单张高清抓拍协议设计

### 1. 通信流程
1. PC 发送：`CAMERA_CAPTURE\r\n`
2. ESP32 执行 `esp_camera_fb_get()` 捕获一帧 JPEG；
3. ESP32 采用**零堆内存流式 Base64 编码**输出：
   ```text
   ===IMG_START:24580===
   /9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBAQEB... (Base64数据流)
   ===IMG_END===
   ```
4. PC 端 `SerialManager` 拦截包头包尾，自动拼装为 `data:image/jpeg;base64,...`；
5. PC 界面监听到新照片事件后，**自动平滑切换到 Camera 标签页**，大图展示成片。

---

## 三、连续实时视频流引擎 (Live Video Stream)

源码文件：[`src/views/CameraView.vue`](file:///d:/AI_serach_image/VisionX/eproject/src/views/CameraView.vue)

### 1. 极速流式协议
* 启动指令：`STREAM_START\r\n`
* 停止指令：`STREAM_STOP\r\n`
* 数据帧协议：`===FRAME_START:<len>===` ... `===FRAME_END===`
* **静默直通机制**：为了避免 15 FPS 带来的高频数据把控制台文本刷爆，`FRAME_START` 数据帧直接由后台分流直推渲染器，**不经过任何控制台文本日志**，保证极端流畅。

### 2. 动态分辨率与帧率调优
| 分辨率规格 | 像素大小 | 单帧体积 | 视频实测表现 | 推荐场景 |
| :--- | :---: | :---: | :---: | :--- |
| **QVGA** | 320 x 240 | 约 5 ~ 7 KB | **12 ~ 18 FPS (超流畅)** | **实时视频流预览 (首选)** |
| **VGA** | 640 x 480 | 约 15 ~ 20 KB | 6 ~ 8 FPS (均衡) | 桌面近距离观察 |
| **SVGA** | 800 x 600 | 约 25 ~ 35 KB | 1 ~ 2 FPS (低频) | 单张高画质拍照 |

### 3. PC 仪表盘指标
* **实测帧率 (FPS)**：动态统计过去 1 秒内接收的有效帧数；
* **实时码率 (KB/s)**：动态计算每秒接收的字节吞吐量；
* **一键快照保存**：在播放视频流时，随时点击 `[ 💾 保存当前画面 ]` 即可将视频流当前瞬间保存为本地高清图片。

---

## 四、照片抓拍成片展示与时序竞态架构修复 (v1.0.3)

在早期版本中，当用户在串口页触发拍照或硬件回传照片时，可能出现“串口已收到照片但 Camera 页面依然停留在空准星”的现象，我们在 `v1.0.3` 中对数据链路进行了彻底的重构治理：

### 1. 核心瓶颈排查
1. **组件生命周期竞态 (Lifecycle Race Condition)**：
   * 原先逻辑在 `App.vue` 收到 `camera:photo` 时切换当前标签页为 `camera`；
   * 但 Vue 动态渲染组件需要微任务周期的 DOM 创建与挂载，`CameraView.vue` 尚未完成 `onMounted()` 注册，单次触发的 IPC 事件就已经广播完毕；
   * 且 `CameraView` 内部只依赖单次的局部 `ref(null)`，导致切换后由于错过事件而显示空白。
2. **串口行切片死锁 (Buffer Delimiter Deadlock)**：
   * 照片流大小常达 2.5 ~ 3.5 万个 Base64 字符。原先按 `\r\n` 换行切片的逻辑中，若最后一包 `===IMG_END===` 刚好落在 TCP/USB 块末尾且没有紧随的换行符，`lines.pop()` 会将结束标签暂扣在缓冲区等待下一个换行，导致主进程解析陷入假死。
3. **USB CDC 硬件 FIFO 残留**：
   * ESP32-S3 内部 USB CDC TX FIFO 为 256 字节，连续推送数千字节循环后若未显式调用 `Serial.flush()`，尾部数据无法毫秒级送出。

### 2. 解决方案实现

#### A. 主进程级全局照片持久化 (`CameraManager.ts`)
* 主进程作为单例中心，永久保存最后一张拍摄的照片对象：
  ```typescript
  export interface PhotoData {
    base64: string;
    dataUri: string;
    size: number;
    time: string;
  }
  // CameraManager 内部维护 lastPhoto，并暴露 getLastPhoto() IPC
  ```
* `CameraView.vue` 同时监听 `onMounted()` 与 `onActivated()`（keep-alive 切页触发），组件激活的第一时刻**主动拉取最新照片**，无论切页时序如何，成片 100% 秒级渲染。

#### B. 重构流式定界符解析引擎 (`SerialManager.ts`)
* 彻底废弃脆弱的逐行 `split(/\r?\n/)`，升级为基于协议定界符的连续切片引擎：
  ```typescript
  // 基于 indexOf('===IMG_END===') 与 indexOf('===FRAME_END===') 切割
  const endMarker = '===IMG_END===';
  const endIdx = this.rxBuffer.indexOf(endMarker);
  if (endIdx !== -1) {
    const payload = this.rxBuffer.slice(0, endIdx);
    this.imageBuffer += payload.replace(/[\r\n\s]/g, '');
    this.rxBuffer = this.rxBuffer.slice(endIdx + endMarker.length);
    // 立即组装 dataUri 并通过 image 事件发射
  }
  ```
* 具备增量提取机制：未收到结束符时，自动将前序稳定 Base64 移入缓存，保留尾部防截断，内存占用极低且完全免疫粘包。

#### C. 固件显式强制刷新 (`main.cpp` / `Xiao_Camera_Serial_Debug.ino`)
* 在 `streamPhotoBase64()` 与 `streamFrameBase64()` 尾部追加 `Serial.flush()`，确保硬件层瞬间清空发送队列。

#### D. Camera 界面状态胶囊与加载防护
* 顶部新增连通状态胶囊：`🟢 串口已连接 (COM4)` / `🔴 串口未连接`；
* 拍照时启用半透明科技感 Loading 浮层与 10 秒超时防死锁熔断；未连接串口时点击拍照有明确交互拦截。
