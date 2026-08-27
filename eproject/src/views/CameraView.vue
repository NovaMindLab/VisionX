<template>
  <div class="camera-view">
    <div class="card preview-card">
      <div class="card-header">
        <div class="header-title">
          <span class="icon">📷</span>
          <span>Camera Preview (摄像头实时视频流与抓拍)</span>
        </div>

        <div class="header-controls">
          <!-- 分辨率切换 -->
          <div class="res-selector">
            <label>分辨率模式：</label>
            <select v-model="selectedRes" @change="changeResolution" :disabled="isStreaming">
              <option value="QVGA">QVGA (320x240 - 推荐高帧率视频)</option>
              <option value="VGA">VGA (640x480 - 均衡模式)</option>
              <option value="SVGA">SVGA (800x600 - 高清静止拍照)</option>
            </select>
          </div>

          <span class="badge" :class="isStreaming ? 'badge-red' : 'badge-gray'">
            {{ isStreaming ? '🔴 LIVE 实时视频中' : '○ 待命中 (Standby)' }}
          </span>
        </div>
      </div>

      <!-- 画面呈现主区域 -->
      <div class="preview-area">
        <!-- 视频流播放层 -->
        <div class="stream-container" v-if="isStreaming && liveStreamUri">
          <img :src="liveStreamUri" alt="Live Video Feed" class="video-feed" />
          <div class="live-overlay">
            <span class="live-tag">● LIVE STREAM</span>
            <span>{{ selectedRes }} | {{ measuredFps }} FPS | {{ (dataRate / 1024).toFixed(1) }} KB/s</span>
          </div>
        </div>

        <!-- 单张拍照展示层 -->
        <div class="image-display" v-else-if="capturedImage">
          <img :src="capturedImage" alt="Captured Photo" class="photo-feed" />
          <div class="photo-overlay">
            <span>📷 静止照片 | {{ photoTime }} | {{ (photoSize / 1024).toFixed(1) }} KB</span>
          </div>
        </div>

        <!-- 初始空状态 -->
        <div class="camera-frame-placeholder" v-else>
          <div class="viewfinder-box">
            <span class="crosshair">+</span>
          </div>
          <p class="hint-title">实时画面就绪</p>
          <p class="hint-text">点击下方 <strong>[ ▶ 启动视频流 ]</strong> 开启实时视频采集，或点击 <strong>[ 📸 拍照 ]</strong> 获取高清静止图像</p>
        </div>
      </div>

      <!-- 底部指标与控制栏 -->
      <div class="card-footer">
        <div class="metrics">
          <span class="metric-item"><strong>镜头型号：</strong>OV2640 DVP</span>
          <span class="metric-item"><strong>当前规格：</strong>{{ selectedRes }}</span>
          <span class="metric-item" v-if="isStreaming">
            <strong>实时帧率：</strong><span class="highlight">{{ measuredFps }} FPS</span>
          </span>
          <span class="metric-item" v-if="isStreaming">
            <strong>传输速率：</strong><span class="highlight">{{ (dataRate / 1024).toFixed(1) }} KB/s</span>
          </span>
          <span class="metric-item" v-if="!isStreaming && photoSize > 0">
            <strong>最后照片大小：</strong>{{ (photoSize / 1024).toFixed(1) }} KB
          </span>
        </div>

        <div class="actions">
          <button class="btn btn-secondary" v-if="capturedImage || isStreaming" @click="saveCurrentImage">
            💾 保存当前画面 (Save)
          </button>
          
          <button class="btn btn-primary" :disabled="isCapturing" @click="triggerCapture">
            {{ isCapturing ? '正在拍照...' : '📸 拍照 (Capture)' }}
          </button>

          <button class="btn btn-success" v-if="!isStreaming" @click="startStream">
            ▶ 启动实时视频流 (Start Video)
          </button>
          <button class="btn btn-danger" v-else @click="stopStream">
            ⏹ 停止视频 (Stop Video)
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';

const isStreaming = ref(false);
const selectedRes = ref('QVGA');
const capturedImage = ref<string | null>(null);
const liveStreamUri = ref<string | null>(null);
const photoSize = ref<number>(0);
const photoTime = ref<string>('');
const isCapturing = ref(false);

const measuredFps = ref<number>(0);
const dataRate = ref<number>(0);

let frameCount = 0;
let bytesCount = 0;
let lastMetricsTime = performance.now();

let unsubscribePhoto: (() => void) | null = null;
let unsubscribeFrame: (() => void) | null = null;

// 开启连续视频流
async function startStream() {
  isStreaming.value = true;
  frameCount = 0;
  bytesCount = 0;
  lastMetricsTime = performance.now();
  await window.electronAPI.camera.start();
}

// 停止连续视频流
async function stopStream() {
  isStreaming.value = false;
  measuredFps.value = 0;
  dataRate.value = 0;
  await window.electronAPI.camera.stop();
}

// 单张拍照
async function triggerCapture() {
  isCapturing.value = true;
  await window.electronAPI.camera.capture();
  setTimeout(() => {
    isCapturing.value = false;
  }, 2000);
}

// 切换分辨率
async function changeResolution() {
  if (window.electronAPI && window.electronAPI.camera.setResolution) {
    await window.electronAPI.camera.setResolution(selectedRes.value);
  }
}

// 保存当前帧/照片
async function saveCurrentImage() {
  const targetUri = isStreaming.value ? liveStreamUri.value : capturedImage.value;
  if (!targetUri) return;
  const res = await window.electronAPI.camera.savePhoto(targetUri, `SmartGlass_${selectedRes.value}_${Date.now()}.jpg`);
  if (res.success) {
    alert(`照片已保存至：\n${res.filePath}`);
  }
}

onMounted(() => {
  if (window.electronAPI && window.electronAPI.camera) {
    // 监听单张拍照回传
    unsubscribePhoto = window.electronAPI.camera.onPhoto((photo) => {
      capturedImage.value = photo.dataUri;
      photoSize.value = photo.size;
      photoTime.value = photo.time;
      isCapturing.value = false;
    });

    // 监听连续视频流回传
    unsubscribeFrame = window.electronAPI.camera.onFrame((frame) => {
      liveStreamUri.value = frame.dataUri;
      frameCount++;
      bytesCount += frame.size;

      const now = performance.now();
      const elapsed = now - lastMetricsTime;
      if (elapsed >= 1000) {
        measuredFps.value = Math.round((frameCount * 1000) / elapsed);
        dataRate.value = Math.round((bytesCount * 1000) / elapsed);
        frameCount = 0;
        bytesCount = 0;
        lastMetricsTime = now;
      }
    });
  }
});

onUnmounted(() => {
  if (isStreaming.value) {
    stopStream();
  }
  if (unsubscribePhoto) unsubscribePhoto();
  if (unsubscribeFrame) unsubscribeFrame();
});
</script>

<style scoped>
.camera-view {
  height: 100%;
}

.card {
  background: #1e293b;
  border-radius: 8px;
  border: 1px solid #334155;
  display: flex;
  flex-direction: column;
  height: 100%;
}

.card-header {
  padding: 10px 16px;
  border-bottom: 1px solid #334155;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  color: #f8fafc;
  font-size: 15px;
}

.header-controls {
  display: flex;
  align-items: center;
  gap: 16px;
}

.res-selector {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: #94a3b8;
}

.res-selector select {
  background: #0f172a;
  border: 1px solid #475569;
  color: #f8fafc;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  outline: none;
}

.badge {
  font-size: 11px;
  padding: 3px 10px;
  border-radius: 12px;
  font-weight: 600;
}

.badge-red {
  background: #7f1d1d;
  color: #fca5a5;
  border: 1px solid #ef4444;
  animation: pulse 1.5s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}

.badge-gray {
  background: #0f172a;
  color: #94a3b8;
  border: 1px solid #475569;
}

.preview-area {
  flex: 1;
  background: #090d16;
  display: flex;
  justify-content: center;
  align-items: center;
  position: relative;
  overflow: hidden;
}

.stream-container,
.image-display {
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  position: relative;
}

.video-feed,
.photo-feed {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  box-shadow: 0 0 20px rgba(0, 0, 0, 0.6);
}

.live-overlay,
.photo-overlay {
  position: absolute;
  top: 12px;
  left: 12px;
  background: rgba(15, 23, 42, 0.85);
  backdrop-filter: blur(4px);
  padding: 4px 12px;
  border-radius: 4px;
  border: 1px solid #334155;
  font-size: 12px;
  color: #f1f5f9;
  font-family: monospace;
  display: flex;
  align-items: center;
  gap: 10px;
}

.live-tag {
  color: #ef4444;
  font-weight: 700;
}

.camera-frame-placeholder {
  text-align: center;
  color: #64748b;
}

.viewfinder-box {
  width: 220px;
  height: 160px;
  border: 1px dashed #334155;
  margin: 0 auto 12px auto;
  display: flex;
  justify-content: center;
  align-items: center;
  position: relative;
}

.crosshair {
  font-size: 24px;
  color: #475569;
}

.hint-title {
  margin: 0 0 4px 0;
  font-size: 14px;
  color: #cbd5e1;
  font-weight: 500;
}

.hint-text {
  margin: 0;
  font-size: 12px;
  color: #64748b;
}

.card-footer {
  padding: 10px 16px;
  border-top: 1px solid #334155;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.metrics {
  display: flex;
  gap: 16px;
  font-size: 13px;
  color: #94a3b8;
}

.highlight {
  color: #38bdf8;
  font-weight: 600;
  font-family: monospace;
}

.actions {
  display: flex;
  gap: 8px;
}

.btn {
  padding: 6px 14px;
  border-radius: 4px;
  border: none;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn-primary {
  background: #0284c7;
  color: #fff;
}
.btn-primary:hover {
  background: #0369a1;
}

.btn-success {
  background: #059669;
  color: #fff;
}
.btn-success:hover {
  background: #047857;
}

.btn-danger {
  background: #dc2626;
  color: #fff;
}
.btn-danger:hover {
  background: #b91c1c;
}

.btn-secondary {
  background: #334155;
  color: #f1f5f9;
}
.btn-secondary:hover {
  background: #475569;
}
</style>
