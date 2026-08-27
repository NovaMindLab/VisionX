<template>
  <div class="status-view">
    <div class="header-banner card">
      <h2>智能眼镜硬件状态总览</h2>
      <p class="subtitle">实时聚合 ESP32 主控、传感器与无线网络子系统在线指标</p>
    </div>

    <div class="status-grid">
      <!-- ESP32 主控 -->
      <div class="status-card card" :class="{ online: status.esp32.connected }">
        <div class="card-header">
          <div class="title-group">
            <span class="icon">⚡</span>
            <span class="module-name">ESP32-S3 主控</span>
          </div>
          <span class="status-badge" :class="status.esp32.connected ? 'badge-green' : 'badge-gray'">
            {{ status.esp32.connected ? '● Connected' : '○ Disconnected' }}
          </span>
        </div>
        <div class="card-body">
          <div class="info-row">
            <span class="label">芯片型号：</span>
            <span class="val">{{ status.esp32.chip }}</span>
          </div>
          <div class="info-row">
            <span class="label">COM 端口：</span>
            <span class="val">{{ status.esp32.port || '未连接' }}</span>
          </div>
          <div class="info-row">
            <span class="label">波特率：</span>
            <span class="val">{{ status.esp32.baudRate ? `${status.esp32.baudRate} bps` : '--' }}</span>
          </div>
          <div class="info-row">
            <span class="label">物理 MAC：</span>
            <span class="val mono">{{ status.esp32.mac }}</span>
          </div>
        </div>
      </div>

      <!-- 摄像头 -->
      <div class="status-card card" :class="{ online: status.camera.status === 'ready' || status.camera.status === 'streaming' }">
        <div class="card-header">
          <div class="title-group">
            <span class="icon">📷</span>
            <span class="module-name">Camera (摄像头)</span>
          </div>
          <span class="status-badge" :class="status.camera.status === 'ready' ? 'badge-green' : 'badge-yellow'">
            ● {{ status.camera.status === 'ready' ? 'Ready' : status.camera.status }}
          </span>
        </div>
        <div class="card-body">
          <div class="info-row">
            <span class="label">传感器模组：</span>
            <span class="val">{{ status.camera.model }}</span>
          </div>
          <div class="info-row">
            <span class="label">抓拍分辨率：</span>
            <span class="val">{{ status.camera.resolution }}</span>
          </div>
          <div class="info-row">
            <span class="label">预期帧率：</span>
            <span class="val">{{ status.camera.fps }} FPS</span>
          </div>
          <div class="info-row">
            <span class="label">接口类型：</span>
            <span class="val">DVP 24-Pin 0.5mm FPC</span>
          </div>
        </div>
      </div>

      <!-- 麦克风 -->
      <div class="status-card card online">
        <div class="card-header">
          <div class="title-group">
            <span class="icon">🎙️</span>
            <span class="module-name">Microphone (麦克风)</span>
          </div>
          <span class="status-badge badge-green">● Ready</span>
        </div>
        <div class="card-body">
          <div class="info-row">
            <span class="label">麦克风型号：</span>
            <span class="val">{{ status.microphone.model }}</span>
          </div>
          <div class="info-row">
            <span class="label">采样率：</span>
            <span class="val">{{ status.microphone.sampleRate }} Hz (16-bit)</span>
          </div>
          <div class="info-row">
            <span class="label">声道配置：</span>
            <span class="val">单声道数字 PDM (Mono)</span>
          </div>
          <div class="info-row">
            <span class="label">引脚定义：</span>
            <span class="val">CLK: GPIO 42 / DATA: GPIO 41</span>
          </div>
        </div>
      </div>

      <!-- 显示屏 (用户已确认未安装) -->
      <div class="status-card card offline">
        <div class="card-header">
          <div class="title-group">
            <span class="icon">🖥️</span>
            <span class="module-name">Display (显示屏)</span>
          </div>
          <span class="status-badge badge-gray">○ Not Installed</span>
        </div>
        <div class="card-body">
          <div class="info-row">
            <span class="label">硬件状态：</span>
            <span class="val text-muted">未安装外接屏幕 (纯语音/视觉模式)</span>
          </div>
          <div class="info-row">
            <span class="label">状态说明：</span>
            <span class="val text-muted">{{ status.display.message }}</span>
          </div>
        </div>
      </div>

      <!-- Wi-Fi -->
      <div class="status-card card" :class="{ online: status.wifi.connected }">
        <div class="card-header">
          <div class="title-group">
            <span class="icon">📶</span>
            <span class="module-name">Wi-Fi (局域网)</span>
          </div>
          <span class="status-badge" :class="status.wifi.connected ? 'badge-green' : 'badge-gray'">
            {{ status.wifi.connected ? '● Connected' : '○ Standby' }}
          </span>
        </div>
        <div class="card-body">
          <div class="info-row">
            <span class="label">连接状态：</span>
            <span class="val">{{ status.wifi.connected ? '已接入局域网/热点' : '待命 (通过 BLE 配网)' }}</span>
          </div>
          <div class="info-row" v-if="status.wifi.ssid">
            <span class="label">SSID：</span>
            <span class="val">{{ status.wifi.ssid }}</span>
          </div>
          <div class="info-row" v-if="status.wifi.ip">
            <span class="label">IP 地址：</span>
            <span class="val mono">{{ status.wifi.ip }}</span>
          </div>
        </div>
      </div>

      <!-- 蓝牙 BLE -->
      <div class="status-card card online">
        <div class="card-header">
          <div class="title-group">
            <span class="icon">🔵</span>
            <span class="module-name">Bluetooth (BLE 5.0)</span>
          </div>
          <span class="status-badge badge-green">● Ready</span>
        </div>
        <div class="card-body">
          <div class="info-row">
            <span class="label">BLE 模式：</span>
            <span class="val">GATT Peripheral (广播就绪)</span>
          </div>
          <div class="info-row">
            <span class="label">广播名称：</span>
            <span class="val">{{ status.bluetooth.deviceName }}</span>
          </div>
          <div class="info-row">
            <span class="label">主要用途：</span>
            <span class="val">低功耗音频传输与热点配网指令</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import type { UnifiedDeviceStatus } from '@/types/electron';

const status = ref<UnifiedDeviceStatus>({
  esp32: {
    connected: false,
    chip: 'Seeed Studio XIAO ESP32-S3 Sense',
    mac: '98:A3:16:F7:8C:08',
  },
  camera: {
    model: 'OV2640 (Seeed XIAO Sense DVP)',
    status: 'ready',
    resolution: '800x600 (SVGA)',
    fps: 15,
  },
  microphone: {
    model: 'MSM261D3526H1CPM (Digital PDM Mic)',
    status: 'ready',
    sampleRate: 16000,
    channels: 1,
    currentVolume: 0,
  },
  display: {
    installed: false,
    status: 'not_installed',
    model: 'None',
    message: '智能眼镜当前运行于无屏环境感知模式',
  },
  wifi: {
    connected: false,
    status: 'disconnected',
  },
  bluetooth: {
    enabled: true,
    status: 'ready',
    deviceName: 'VisionX-Glass',
  },
});

let unsubscribe: (() => void) | null = null;

onMounted(async () => {
  if (window.electronAPI) {
    status.value = await window.electronAPI.device.getStatus();
    unsubscribe = window.electronAPI.device.onStatusUpdate((newStatus) => {
      status.value = newStatus;
    });
  }
});

onUnmounted(() => {
  if (unsubscribe) unsubscribe();
});
</script>

<style scoped>
.status-view {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.card {
  background: #1e293b;
  border-radius: 8px;
  border: 1px solid #334155;
  padding: 16px;
}

.header-banner h2 {
  margin: 0 0 6px 0;
  font-size: 18px;
  color: #f1f5f9;
}

.subtitle {
  margin: 0;
  font-size: 13px;
  color: #94a3b8;
}

.status-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 16px;
}

.status-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
  transition: all 0.2s ease;
}

.status-card.online {
  border-left: 4px solid #22c55e;
}

.status-card.offline {
  border-left: 4px solid #64748b;
  opacity: 0.85;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid #334155;
  padding-bottom: 10px;
}

.title-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.icon {
  font-size: 18px;
}

.module-name {
  font-weight: 600;
  font-size: 15px;
  color: #f8fafc;
}

.status-badge {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 12px;
  font-weight: 600;
}

.badge-green {
  background: #064e3b;
  color: #34d399;
  border: 1px solid #059669;
}

.badge-gray {
  background: #1e293b;
  color: #94a3b8;
  border: 1px solid #475569;
}

.badge-yellow {
  background: #78350f;
  color: #fbbf24;
  border: 1px solid #b45309;
}

.card-body {
  display: flex;
  flex-direction: column;
  gap: 8px;
  font-size: 13px;
}

.info-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.label {
  color: #94a3b8;
}

.val {
  color: #f1f5f9;
  font-weight: 500;
}

.mono {
  font-family: monospace;
}

.text-muted {
  color: #64748b;
}
</style>
