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
