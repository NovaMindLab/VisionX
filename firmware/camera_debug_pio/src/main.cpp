/**
 * Xiao_Camera_Serial_Debug.ino / main.cpp
 * 
 * 专为 Seeed Studio XIAO ESP32-S3 Sense 设计的【串口拍照与连续视频流】固件
 * 配合 Electron Smart Glass Debug Console 使用
 * 
 * 功能：
 * 1. 初始化 OV2640 摄像头 (支持 QVGA 320x240 高帧率视频 / SVGA 800x600 高清拍照)
 * 2. 串口指令支持：
 *    - "STREAM_START" / "CAMERA_START" : 启动连续实时视频流传输 (约 12~18 FPS)
 *    - "STREAM_STOP" / "CAMERA_STOP"   : 停止视频流
 *    - "CAPTURE" / "CAMERA_CAPTURE"   : 单张拍照并回传
 *    - "RES_QVGA" / "RES_VGA" / "RES_SVGA" : 动态调整分辨率
 *    - "PING" / "STATUS" / "RESTART"
 */

#include <Arduino.h>
#include "esp_camera.h"

// -------------------------------------------------------------
// Seeed Studio XIAO ESP32-S3 Sense 原生引脚定义
// -------------------------------------------------------------
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

static const char b64_table[] = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
bool isStreaming = false;

// 流式 Base64 发送单张照片 (带 IMG 标签)
void streamPhotoBase64(camera_fb_t *fb) {
    Serial.printf("===IMG_START:%u===\n", fb->len);
    size_t i = 0;
    char chunk[4];
    while (i < fb->len) {
        uint32_t octet_a = i < fb->len ? (unsigned char)fb->buf[i++] : 0;
        uint32_t octet_b = i < fb->len ? (unsigned char)fb->buf[i++] : 0;
        uint32_t octet_c = i < fb->len ? (unsigned char)fb->buf[i++] : 0;
        uint32_t triple = (octet_a << 16) + (octet_b << 8) + octet_c;

        chunk[0] = b64_table[(triple >> 18) & 0x3F];
        chunk[1] = b64_table[(triple >> 12) & 0x3F];
        chunk[2] = (i > fb->len + 1) ? '=' : b64_table[(triple >> 6) & 0x3F];
        chunk[3] = (i > fb->len) ? '=' : b64_table[triple & 0x3F];
        Serial.write((const uint8_t*)chunk, 4);
    }
    Serial.println("\n===IMG_END===");
    Serial.flush();
}

// 流式 Base64 发送连续视频帧 (带 FRAME 标签，供上位机连续渲染)
void streamFrameBase64(camera_fb_t *fb) {
    Serial.printf("===FRAME_START:%u===\n", fb->len);
    size_t i = 0;
    char chunk[4];
    while (i < fb->len) {
        uint32_t octet_a = i < fb->len ? (unsigned char)fb->buf[i++] : 0;
        uint32_t octet_b = i < fb->len ? (unsigned char)fb->buf[i++] : 0;
        uint32_t octet_c = i < fb->len ? (unsigned char)fb->buf[i++] : 0;
        uint32_t triple = (octet_a << 16) + (octet_b << 8) + octet_c;

        chunk[0] = b64_table[(triple >> 18) & 0x3F];
        chunk[1] = b64_table[(triple >> 12) & 0x3F];
        chunk[2] = (i > fb->len + 1) ? '=' : b64_table[(triple >> 6) & 0x3F];
        chunk[3] = (i > fb->len) ? '=' : b64_table[triple & 0x3F];
        Serial.write((const uint8_t*)chunk, 4);
    }
    Serial.println("\n===FRAME_END===");
    Serial.flush();
}

void initCamera() {
    camera_config_t config;
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
    // 默认 QVGA (320x240)，体积小(~6KB/帧)，保证 15+ FPS 流畅视频流
    config.frame_size = FRAMESIZE_QVGA;
    config.pixel_format = PIXFORMAT_JPEG;
    config.grab_mode = CAMERA_GRAB_LATEST;
    config.fb_location = CAMERA_FB_IN_PSRAM;
    config.jpeg_quality = 14;
    config.fb_count = 2;

    esp_err_t err = esp_camera_init(&config);
    if (err != ESP_OK) {
        Serial.printf("[ERROR] Camera init failed with error 0x%x\n", err);
        return;
    }
    Serial.println("[INFO] OV2640 Camera initialized successfully!");
}

void setup() {
    Serial.begin(115200);
    delay(1500);

    Serial.println("Hello from Seeed Studio XIAO ESP32-S3 Sense");
    Serial.println("[INFO] Booting Smart Glass Firmware with Live Video & Photo Support...");

    initCamera();
}

void loop() {
    // 1. 处理串口指令
    if (Serial.available()) {
        String cmd = Serial.readStringUntil('\n');
        cmd.trim();

        if (cmd.length() > 0) {
            if (cmd == "STREAM_START" || cmd == "CAMERA_START") {
                isStreaming = true;
                Serial.println("[INFO] Live video stream started.");
            }
            else if (cmd == "STREAM_STOP" || cmd == "CAMERA_STOP") {
                isStreaming = false;
                Serial.println("[INFO] Live video stream stopped.");
            }
            else if (cmd == "CAPTURE" || cmd == "CAMERA_CAPTURE") {
                Serial.println("[INFO] Capturing photo from OV2640...");
                camera_fb_t *fb = esp_camera_fb_get();
                if (fb) {
                    Serial.printf("[INFO] Photo captured: %u bytes. Streaming to PC...\n", fb->len);
                    streamPhotoBase64(fb);
                    esp_camera_fb_return(fb);
                } else {
                    Serial.println("[ERROR] Failed to get camera frame buffer!");
                }
            }
            else if (cmd.startsWith("RES_")) {
                sensor_t *s = esp_camera_sensor_get();
                if (s) {
                    if (cmd == "RES_QVGA") s->set_framesize(s, FRAMESIZE_QVGA);
                    else if (cmd == "RES_VGA") s->set_framesize(s, FRAMESIZE_VGA);
                    else if (cmd == "RES_SVGA") s->set_framesize(s, FRAMESIZE_SVGA);
                    Serial.printf("[INFO] Camera resolution set to %s\n", cmd.substring(4).c_str());
                }
            }
            else if (cmd == "PING") {
                Serial.println("PONG");
            }
            else if (cmd == "STATUS" || cmd == "GET_DEVICE_INFO") {
                Serial.printf("{\"device\":\"Seeed Studio XIAO ESP32-S3 Sense\",\"streaming\":%s,\"camera\":\"OV2640\"}\n",
                              isStreaming ? "true" : "false");
            }
            else if (cmd == "RESTART") {
                Serial.println("[WARN] Restarting ESP32...");
                delay(500);
                ESP.restart();
            }
        }
    }

    // 2. 连续视频流捕获与传输
    if (isStreaming) {
        camera_fb_t *fb = esp_camera_fb_get();
        if (fb) {
            streamFrameBase64(fb);
            esp_camera_fb_return(fb);
        }
        // 适当让渡 CPU 时间片
        vTaskDelay(pdMS_TO_TICKS(15));
    }
}
