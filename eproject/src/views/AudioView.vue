<template>
  <div class="audio-view">
    <div class="card audio-card">
      <div class="card-header">
        <div class="header-title">
          <span class="icon">🎙️</span>
          <span>Microphone (麦克风音频采集与波形分析)</span>
        </div>
        <span class="badge" :class="isRecording ? 'badge-green' : 'badge-gray'">
          {{ isRecording ? '● Active' : '○ Standby' }}
        </span>
      </div>

      <div class="waveform-area">
        <div class="waveform-container">
          <div class="waveform-bars">
            <div
              v-for="(bar, i) in bars"
              :key="i"
              class="bar"
              :style="{ height: `${bar}%` }"
            ></div>
          </div>
        </div>

        <!-- 音量进度指示 -->
        <div class="volume-meter">
          <span class="vol-label">实时电平 Volume:</span>
          <div class="meter-track">
            <div class="meter-fill" :style="{ width: `${volume}%` }"></div>
          </div>
          <span class="vol-val">{{ volume }}%</span>
        </div>
      </div>

      <div class="card-footer">
        <div class="metrics">
          <span class="metric-item"><strong>采样率：</strong>16000 Hz</span>
          <span class="metric-item"><strong>声道：</strong>Mono (单声道)</span>
          <span class="metric-item"><strong>格式：</strong>16-bit PDM</span>
        </div>

        <div class="actions">
          <button class="btn btn-primary" v-if="!isRecording" @click="startAudio">
            ▶ 开始采集 (Start)
          </button>
          <button class="btn btn-danger" v-else @click="stopAudio">
            ⏹ 停止采集 (Stop)
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

const isRecording = ref(false);
const volume = ref(25);
const bars = ref<number[]>([15, 20, 35, 60, 45, 30, 20, 40, 55, 70, 85, 65, 40, 25, 30, 15]);

async function startAudio() {
  isRecording.value = true;
  await window.electronAPI.audio.start();
}

async function stopAudio() {
  isRecording.value = false;
  await window.electronAPI.audio.stop();
}
</script>

<style scoped>
.audio-view {
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
  padding: 12px 16px;
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
}

.badge {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 12px;
  font-weight: 600;
}

.badge-green {
  background: #064e3b;
  color: #34d399;
}
.badge-gray {
  background: #0f172a;
  color: #94a3b8;
}

.waveform-area {
  flex: 1;
  background: #090d16;
  padding: 24px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 32px;
}

.waveform-container {
  width: 80%;
  height: 140px;
  border-bottom: 1px solid #334155;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}

.waveform-bars {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  height: 100%;
}

.bar {
  width: 12px;
  background: #38bdf8;
  border-radius: 4px 4px 0 0;
  transition: height 0.1s ease;
}

.volume-meter {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 60%;
}

.vol-label {
  font-size: 13px;
  color: #94a3b8;
  width: 140px;
}

.meter-track {
  flex: 1;
  height: 10px;
  background: #1e293b;
  border-radius: 5px;
  overflow: hidden;
  border: 1px solid #334155;
}

.meter-fill {
  height: 100%;
  background: linear-gradient(90deg, #22c55e, #eab308, #ef4444);
  border-radius: 5px;
  transition: width 0.15s ease;
}

.vol-val {
  font-family: monospace;
  font-size: 13px;
  color: #f1f5f9;
  width: 40px;
}

.card-footer {
  padding: 12px 16px;
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

.btn {
  padding: 7px 16px;
  border-radius: 4px;
  border: none;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
}

.btn-primary {
  background: #0284c7;
  color: #fff;
}
.btn-danger {
  background: #dc2626;
  color: #fff;
}
</style>
