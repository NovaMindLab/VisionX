# 03. 固件开发与烧录指南

本文档详细讲解 ESP32-S3 智能眼镜固件架构、开发环境搭建、关键配置参数、核心功能模块代码逻辑以及常见硬件固件排错指南。

---

## 1. 固件架构与模块划分

智能眼镜端固件主要基于 **Arduino-ESP32 / ESP-IDF** 框架，核心结构划分为 5 大子系统：

```
                    ┌────────────────────────────┐
                    │      VisionX Main App      │
                    └─────────────┬──────────────┘
                                  │
    ┌──────────────┬──────────────┼──────────────┬──────────────┐
    ▼              ▼              ▼              ▼              ▼
┌─────────┐  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌───────────┐
│ Camera  │  │ PDM Audio │  │ BLE GATT  │  │ Wi-Fi API │  │ Power &   │
│ Driver  │  │ Capture   │  │ Service   │  │ Client    │  │ Touch Mgr │
└─────────┘  └───────────┘  └───────────┘  └───────────┘  └───────────┘
```

1. **Camera Driver**：初始化 OV2640/3660，支持动态分辨率切换（如预览用 QVGA 320x240，高质抓拍用 SVGA 800x600 或 UXGA 1600x1200）。
2. **PDM Audio Capture**：通过 I2S 硬件外设以 16kHz 16-bit 持续采集数字麦克风环境音，并做音量阈值检测 (VAD)。
3. **BLE GATT Service**：维护音频流特征值、设备状态、电池电量及抓拍触发通道。
4. **Wi-Fi Photo Streamer**：在触发拍照时快速唤醒 Wi-Fi，通过 HTTP Multipart POST 将 JPEG 二进制流极速推送到手机或局域网中继网关。
5. **Power & Touch Manager**：监听触摸引脚 (Touch Pin)，负责平时进入轻度睡眠 (Light Sleep) 降低功耗，并在轻触时瞬间唤醒抓拍。

---

## 2. 开发环境搭建 (Arduino IDE 方案)

推荐初学者使用 **Arduino IDE 2.x**（熟练开发者可使用 VS Code + PlatformIO）。

### 2.1 安装 ESP32 支持包
1. 打开 Arduino IDE，进入 `文件` -> `首选项`；
2. 在“附加开发板管理器网址”中添加：
   ```text
   https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json
   ```
3. 进入 `工具` -> `开发板` -> `开发板管理器`，搜索 `esp32` 并安装最新稳定版本（建议 2.0.14+ 或 3.0+）。

### 2.2 关键开发板配置 (❗核心配置，错一项会导致无法开机)
在 `工具 (Tools)` 菜单下务必配置如下选项：

| 菜单项 | 设定值 | 说明 |
| :--- | :--- | :--- |
| **Board (开发板)** | `XIAO_ESP32S3` | 选择 Seeed XIAO ESP32S3 专用目标板 |
| **PSRAM** | **`OPI PSRAM`** | **极为重要！** 不开 PSRAM 相机直接报内存溢出崩溃 |
| **Flash Size** | `8MB (64Mb)` | 板载 8MB 高速 Flash |
| **Flash Mode** | `QIO 80MHz` | 高速 Flash 读取 |
| **Partition Scheme** | `Huge APP (3MB No OTA/1MB SPIFFS)` | 保证大模型通信与蓝牙协议栈有足够固件空间 |
| **Core Debug Level** | `Info` 或 `Verbose` (初次调试) | 便于串口监视器排查相机与连接问题 |
| **USB CDC On Boot** | `Enabled` | 启用 Type-C 原生串口打印输出 |

---

## 3. 核心驱动模块与代码实现

### 3.1 摄像头引脚定义 (Seeed XIAO ESP32-S3 Sense 专属)
XIAO S3 扩展板已经将 OV2640 排线引脚预固定，配置如下：

```cpp
#include "esp_camera.h"

#define PWDN_GPIO_NUM     -1
#define RESET_GPIO_NUM    -1
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

camera_config_t config;

void initCamera() {
    config.ledc_channel = LEDC_CHANNEL_0;
    config.ledc_timer = LEDC_TIMER_0;
    config.pin_d0 = Y2_GPIO_NUM;
    config.pin_d1 = Y3_GPIO_NUM;
    config.pin_d2 = Y4_GPIO_NUM;
    config.pin_d3 = Y5_GPIO_NUM;
    config.pin_d4 = Y6_GPIO_NUM;
    config.pin_d5 = Y7_GPIO_NUM;
    config.pin_d6 = Y8_GPIO_NUM;
    config.pin_d7 = Y9_GPIO_NUM;
    config.pin_xclk = XCLK_GPIO_NUM;
    config.pin_pclk = PCLK_GPIO_NUM;
    config.pin_vsync = VSYNC_GPIO_NUM;
    config.pin_href = HREF_GPIO_NUM;
    config.pin_sccb_sda = SIOD_GPIO_NUM;
    config.pin_sccb_scl = SIOC_GPIO_NUM;
    config.pin_pwdn = PWDN_GPIO_NUM;
    config.pin_reset = RESET_GPIO_NUM;
    config.xclk_freq_hz = 20000000;
    config.frame_size = FRAMESIZE_SVGA; // 800x600, 适合多模态 LLM 快速识别
    config.pixel_format = PIXFORMAT_JPEG;
    config.grab_mode = CAMERA_GRAB_LATEST;
    config.fb_location = CAMERA_FB_IN_PSRAM;
    config.jpeg_quality = 12; // 10-63, 越小质量越高
    config.fb_count = 2;

    esp_err_t err = esp_camera_init(&config);
    if (err != ESP_OK) {
        Serial.printf("Camera init failed with error 0x%x\n", err);
        return;
    }
    Serial.println("Camera initialized successfully!");
}
```

### 3.2 麦克风 PDM 采集配置
XIAO S3 扩展板麦克风使用 PDM 模式：
*   **PDM CLK Pin**: `GPIO 42`
*   **PDM DATA Pin**: `GPIO 41`

```cpp
#include <driver/i2s.h>

#define I2S_MIC_CHANNEL I2S_NUM_0
#define PDM_CLK_PIN     42
#define PDM_DATA_PIN    41

void initMicrophone() {
    i2s_config_t i2s_config = {
        .mode = (i2s_mode_t)(I2S_MODE_MASTER | I2S_MODE_RX | I2S_MODE_PDM),
        .sample_rate = 16000,
        .bits_per_sample = I2S_BITS_PER_SAMPLE_16BIT,
        .channel_format = I2S_CHANNEL_FMT_ONLY_RIGHT,
        .communication_format = I2S_COMM_FORMAT_STAND_I2S,
        .intr_alloc_flags = ESP_INTR_FLAG_LEVEL1,
        .dma_buf_count = 8,
        .dma_buf_len = 512,
        .use_apll = false
    };

    i2s_pin_config_t pin_config = {
        .ws_io_num = PDM_CLK_PIN,
        .data_in_num = PDM_DATA_PIN,
        .bck_io_num = -1,
        .data_out_num = -1
    };

    i2s_driver_install(I2S_MIC_CHANNEL, &i2s_config, 0, NULL);
    i2s_set_pin(I2S_MIC_CHANNEL, &pin_config);
    Serial.println("PDM Microphone initialized!");
}
```

### 3.3 抓拍与网络上传逻辑
```cpp
#include <HTTPClient.h>

void captureAndSend(const char* serverUrl) {
    // 1. 点亮指示灯 (保护隐私)
    digitalWrite(LED_BUILTIN, HIGH);

    // 2. 抓取最新帧
    camera_fb_t *fb = esp_camera_fb_get();
    if (!fb) {
        Serial.println("Camera capture failed!");
        digitalWrite(LED_BUILTIN, LOW);
        return;
    }

    // 3. HTTP POST 上传 JPEG 数据
    HTTPClient http;
    http.begin(serverUrl);
    http.addHeader("Content-Type", "image/jpeg");
    int httpResponseCode = http.POST(fb->buf, fb->len);

    Serial.printf("Photo sent, size: %d bytes, response: %d\n", fb->len, httpResponseCode);

    // 4. 释放缓冲区
    esp_camera_fb_return(fb);
    http.end();
    digitalWrite(LED_BUILTIN, LOW);
}
```

---

## 4. 常见排错与避坑指南 (FAQ)

### Q1: 串口提示 `Camera init failed with error 0x105` 或 `ESP_ERR_NO_MEM`？
*   **原因**：未正确开启 PSRAM，或者 PSRAM 模式选择错误。
*   **解决办法**：检查 Arduino IDE 菜单中的 `PSRAM` 是否设置为 **`OPI PSRAM`**（切勿设为 `QSPI PSRAM` 或 `Disabled`）。

### Q2: 抓拍出来的照片全花、有彩条、或全是黑屏？
*   **原因**：摄像头 FPC 金手指排线松动，或者上下层板 B2B 接口未按紧。
*   **解决办法**：关机断电，重新扣合 XIAO 扩展板与主板，轻抬排线翻盖，将摄像头排线插到底后重新锁紧。

### Q3: 开启 Wi-Fi 拍照的一瞬间系统突然重启 (Brownout Reset)？
*   **原因**：Wi-Fi 发射瞬间峰值电流可达 350mA~500mA，如果使用的是细长劣质供电线或微型锂电池内阻过大，会导致瞬时压降触发 ESP32 的掉电保护机制。
*   **解决办法**：
    1. 在电池正负极两端并联一个 100uF~220uF 的贴片钽电容或电解电容做储能去耦；
    2. 更换内阻低、放电倍率大于 1C 的优质聚合物锂电池；
    3. 在代码中可适当调低 Wi-Fi 发射功率：`WiFi.setTxPower(WIFI_POWER_15dBm);`。
