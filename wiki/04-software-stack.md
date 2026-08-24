# 04. 软件与算法栈部署

本文档详细介绍 VisionX 的软件系统架构、移动端 App、云端/本地后端架构、大模型管线（ASR ➔ 多模态 LLM ➔ 记忆库 ➔ TTS），以及专门为**国内开发者**量身定制的本土化 API 替代方案。

---

## 1. 软件全栈架构与流程

```
[ ESP32-S3 智能眼镜 ]
        │ 1. 抓拍 JPEG 图像 / 录制语音
        ▼
[ 手机 App (Flutter) ]
        │ 2. 附加时间戳/GPS/上下文，经由 WebSocket/HTTPS 发送
        ▼
[ 后端网关 (FastAPI) ]
        │
 ┌──────┴────────────────────────────────────────────────────────────────────────┐
 │ 3. ASR 语音识别      4. 多模态视觉大模型        5. 长期记忆引擎      6. 语音合成 TTS │
 │ (FunASR/SenseVoice)  (Qwen2-VL / GPT-4o)      (Chroma / Mem0)     (edge-tts)      │
 └──────┬────────────────────────────────────────────────────────────────────────┘
        │ 7. 流式生成文本答案 + MP3 音频流
        ▼
[ 手机 App / 耳机播报 ] ➔ 用户实时收听 AI 语音解答
```

---

## 2. 核心大模型与算法选型推荐

### 2.1 方案对比 (海外顶级方案 vs 国内高可用方案)

| 环节 | 海外标准方案 (Omi 默认) | 国内平替/本地化高可用方案 (推荐) | 优势与特点 |
| :--- | :--- | :--- | :--- |
| **语音识别 (ASR)** | Deepgram Nova-2 / OpenAI Whisper | **阿里 FunASR / SenseVoiceSmall** | 中文识别率极高，推理延迟 < 150ms，可直接部署在本地 RTX 显卡或普通云服务器 |
| **视觉问答 (VQA)** | OpenAI GPT-4o / Claude 3.5 Sonnet | **阿里通义千问 Qwen2-VL (7B/72B)** / 智谱 GLM-4V | 识图能力比肩 GPT-4o，对中文文字、路标、菜单理解极佳，API 价格实惠且无网络门槛 |
| **对话与推理** | Claude 3.5 / Gemini 2.0 Flash | **DeepSeek-V3 / Qwen-2.5-Turbo** | 推理速度极快，逻辑缜密，极高性价比 |
| **向量记忆库** | Pinecone / Weaviate | **ChromaDB / SQLite-Vec / Mem0** | 轻量级嵌入式部署，无需维护复杂云数据库 |
| **语音合成 (TTS)** | ElevenLabs / Cartesia | **Microsoft edge-tts / 阿里 CosyVoice** | `edge-tts` 完全免费、免 API Key，音质自然流畅；`CosyVoice` 支持声音复刻 |

---

## 3. 极简可运行后端实战 (FastAPI + Qwen2-VL + edge-tts)

以下提供一个开箱即用的 Python 后端原型代码，支持接收图片并结合语音/文字 Prompt 生成 AI 解答和语音播报：

### 3.1 环境安装
```bash
pip install fastapi uvicorn pydantic dashscope edge-tts python-multipart
```

### 3.2 服务端代码 `server.py`
```python
import os
import io
import base64
import asyncio
from fastapi import FastAPI, UploadFile, File, Form
from fastapi.responses import StreamingResponse
import edge_tts
from dashscope import MultiModalConversation

app = FastAPI(title="VisionX AI Smart Glasses Backend")

# 配置通义千问 API KEY (可在阿里云百炼平台免费申领)
os.environ["DASHSCOPE_API_KEY"] = "your-dashscope-api-key-here"

async def generate_voice(text: str, voice: str = "zh-CN-XiaoxiaoNeural") -> io.BytesIO:
    """使用 edge-tts 生成音频流"""
    communicate = edge_tts.Communicate(text, voice)
    audio_stream = io.BytesIO()
    async for chunk in communicate.stream():
        if chunk["type"] == "audio":
            audio_stream.write(chunk["data"])
    audio_stream.seek(0)
    return audio_stream

@app.post("/api/v1/vision_qa")
async def vision_qa(
    prompt: str = Form("请详细描述你看到的画面，并告诉我有什么值得注意的地方？"),
    image: UploadFile = File(...)
):
    """接收智能眼镜上传的图片和提问，调用多模态模型返回图文理解与语音"""
    image_bytes = await image.read()
    b64_image = base64.b64encode(image_bytes).decode("utf-8")
    image_data_uri = f"data:image/jpeg;base64,{b64_image}"

    # 1. 调用多模态大模型 (Qwen2-VL-7B / Qwen-VL-Max)
    messages = [
        {
            "role": "user",
            "content": [
                {"image": image_data_uri},
                {"text": prompt}
            ]
        }
    ]
    
    response = MultiModalConversation.call(
        model='qwen-vl-max',
        messages=messages
    )
    
    ai_text = response.output.choices[0].message.content[0]["text"]

    # 2. 生成语音合成
    audio_stream = await generate_voice(ai_text)

    return {
        "status": "success",
        "question": prompt,
        "answer_text": ai_text,
        "audio_base64": base64.b64encode(audio_stream.read()).decode("utf-8")
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
```

---

## 4. 移动端 (Companion App) 架构

移动端基于 Flutter 构建，核心职责：
1. **BLE 蓝牙管理**：通过 `flutter_blue_plus` 实现设备发现、配对重连、丢包重传及 RSSI 信号监测；
2. **Wi-Fi 局域网配网**：通过 BLE 向 ESP32-S3 下发当前手机热点/Wi-Fi 的 SSID 与密码；
3. **音频/视觉会话管理**：
   * 维护时间轴展示（时间、拍摄照片、AI 对话历史）；
   * 自动调用 `audioplayers` 播放后端传回的 TTS 音频流；
4. **记忆卡片与搜索**：提供类似“日记/第二大脑”的检索界面，允许用户按日期或关键词查询过去一整天的视觉与声音记忆。
