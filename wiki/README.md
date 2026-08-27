# VisionX - 开源多模态 AI 智能眼镜开发 Wiki

> 基于 [BasedHardware/omi](https://github.com/BasedHardware/omi) (原 OpenGlass / Friend) 架构的开源 AI 智能眼镜全栈开发与制作指南。

---

## 📖 项目简介

**VisionX** 是一个定位于“第一人称全天候多模态环境感知与 AI 助理”的开源智能眼镜方案。它借鉴了 **BasedHardware Omi (OmiGlass)** 与行业标杆（如 Ray-Ban Meta、Brilliant Labs Frame）的技术路线，采用 **端-边-云** 协同架构：

1. **硬件端 (Device)**：以超小型 **Seeed Studio XIAO ESP32-S3 Sense** 为计算与感知核心，集成摄像头、数字麦克风与锂电池管理，实现超轻量化佩戴。
2. **移动端 (Companion App)**：基于 **Flutter** 跨平台应用，负责低功耗蓝牙 (BLE) 数据流接收、Wi-Fi 配网与图像中继、本地缓存及用户交互。
3. **后端与 AI 引擎 (Backend & Agent)**：基于 **FastAPI + 多模态大模型 (GPT-4o / Claude 3.5 / Qwen2-VL / Gemini)**，提供实时视觉问答、全天候音频转写、长短期记忆流（Memory Engine）及语音合成 (TTS)。

```
+-----------------------------------------------------------------------+
|                             VisionX 总体架构                          |
+-----------------------------------------------------------------------+
 [ 智能眼镜终端 (ESP32-S3) ] 
       │ (BLE 麦克风音频流 / Wi-Fi 抓拍图像流)
       ▼
 [ 手机 App (Flutter / iOS & Android) ] 
       │ (HTTPS / WebSocket 实时双向通信)
       ▼
 [ 云端服务 (FastAPI / 向量数据库 / 多模态 LLM / ASR / TTS) ]
```

---

## 📚 知识库目录导航

本 Wiki 包含了从零制造一台 AI 智能眼镜所需的全部硬件、固件、软件、结构设计与实战步骤：

| 章节 | 文档名称 | 核心内容 |
| :--- | :--- | :--- |
| **01** | [系统架构与技术选型](./01-architecture-design.md) | 端-边-云数据流、协议选型 (BLE vs Wi-Fi)、系统通信拓扑 |
| **02** | [硬件选型与物料清单 (BOM)](./02-hardware-bom.md) | 核心主控、传感器、电池充放电、外壳结构采购清单与预算预估 |
| **03** | [固件开发与烧录指南](./03-firmware-guide.md) | ESP32-S3 固件架构、摄像头驱动、PSRAM 配置、固件烧录与调试 |
| **04** | [软件与算法栈部署](./04-software-stack.md) | Flutter App、FastAPI 后端、多模态大模型对接、国内网络替代方案 |
| **05** | [结构设计与装配指南](./05-cad-and-assembly.md) | 3D 打印外壳、配重平衡、线缆焊接与整机装配步骤 |
| **06** | [实战落地全流程路线图](./06-roadmap-and-steps.md) | 从零到一的开发实施步骤（MVP 验证 ➔ 装配 ➔ 联调 ➔ 体验调优） |
| **07** | [进阶拓展与演进方向](./07-advanced-features.md) | HUD 光学显示、骨传导音频、端侧本地 AI 唤醒、超低功耗电源优化 |
| **08** | [K2 3D 打印切片与实操](./08-k2-3d-printing-guide.md) | 新手 3 文件极速打印、K2 打印机切片参数、摆盘方向与后处理技巧 |
| **09** | [实机操作与日常使用手册](./09-user-manual-and-quickstart.md) | 开机与蓝牙配对、即拍即问、全天候记忆流、Type-C 充电与排错 |
| **10** | [功能规划与迭代 TODO 清单](./10-feature-roadmap-and-todo.md) | 多模态 AI 识图、PDM 麦克风示波器、相机调参、媒体中心与无线图传规划 |

---

## 📂 本地资源目录

*   📂 **3D 模型文件**：[`3d_models/`](file:///d:/AI_serach_image/VisionX/3d_models/)
    *   外挂夹扣原型 STL (新手必打 3 件套)：[`3d_models/clip_on_case/`](file:///d:/AI_serach_image/VisionX/3d_models/clip_on_case/)
    *   一体镜框整套 STL：[`3d_models/integrated_frame/`](file:///d:/AI_serach_image/VisionX/3d_models/integrated_frame/)
    *   CAD 与 Fusion 360 工程源文件：[`3d_models/cad_sources/`](file:///d:/AI_serach_image/VisionX/3d_models/cad_sources/)
*   📂 **固件源代码**：[`firmware/`](file:///d:/AI_serach_image/VisionX/firmware/)
    *   ESP32-S3 固件源码：[`firmware/firmware.ino`](file:///d:/AI_serach_image/VisionX/firmware/firmware.ino) 与 [`firmware/src/`](file:///d:/AI_serach_image/VisionX/firmware/src/)
