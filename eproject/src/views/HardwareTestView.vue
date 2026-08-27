<template>
  <div class="hardware-test-view">
    <div class="header-banner card">
      <div class="title-area">
        <h2>智能眼镜硬件自动化测试中心</h2>
        <p class="subtitle">一键自检核心硬件，确认固件修改后各外设链路完整性</p>
      </div>
      <button class="btn btn-primary" :disabled="testingAll" @click="runAllTests">
        {{ testingAll ? '正在执行全项体检...' : '🚀 一键全检所有硬件' }}
      </button>
    </div>

    <div class="test-grid">
      <div v-for="item in testItems" :key="item.id" class="test-card card">
        <div class="card-top">
          <div class="module-title">
            <span class="icon">{{ item.icon }}</span>
            <span class="name">{{ item.name }}</span>
          </div>

          <button class="btn btn-secondary test-btn" :disabled="item.running" @click="runSingleTest(item)">
            {{ item.running ? '测试中...' : '[ Test ]' }}
          </button>
        </div>

        <div class="test-result" v-if="item.result">
          <div class="result-header" :class="item.result.success ? 'success' : 'failed'">
            <span class="status-icon">{{ item.result.success ? '✓' : '✗' }}</span>
            <span class="status-msg">{{ item.result.message }}</span>
            <span class="status-time">{{ item.result.timestamp }}</span>
          </div>

          <ul class="details-list" v-if="item.result.details && item.result.details.length > 0">
            <li v-for="(d, idx) in item.result.details" :key="idx">
              {{ d }}
            </li>
          </ul>
        </div>
        <div v-else class="test-placeholder">
          <span>尚未执行测试，点击 [ Test ] 开始检查</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import type { HardwareTestResult } from '@/types/electron';

interface TestModule {
  id: string;
  name: string;
  icon: string;
  running: boolean;
  result?: HardwareTestResult;
}

const testingAll = ref(false);

const testItems = ref<TestModule[]>([
  { id: 'esp32', name: 'ESP32 主控与串口', icon: '⚡', running: false },
  { id: 'camera', name: 'Camera (OV2640)', icon: '📷', running: false },
  { id: 'microphone', name: 'Microphone (PDM 数字麦)', icon: '🎙️', running: false },
  { id: 'display', name: 'Display (显示屏)', icon: '🖥️', running: false },
  { id: 'wifi', name: 'Wi-Fi 局域网传输', icon: '📶', running: false },
  { id: 'bluetooth', name: 'Bluetooth (BLE 5.0)', icon: '🔵', running: false },
]);

async function runSingleTest(item: TestModule) {
  item.running = true;
  try {
    const res = await window.electronAPI.device.testHardware(item.id);
    item.result = res;
  } catch (err: any) {
    item.result = {
      module: item.name,
      success: false,
      message: `测试异常: ${err.message}`,
      timestamp: new Date().toLocaleTimeString(),
    };
  } finally {
    item.running = false;
  }
}

async function runAllTests() {
  testingAll.value = true;
  for (const item of testItems.value) {
    await runSingleTest(item);
  }
  testingAll.value = false;
}
</script>

<style scoped>
.hardware-test-view {
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

.header-banner {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-banner h2 {
  margin: 0 0 4px 0;
  font-size: 18px;
  color: #f1f5f9;
}

.subtitle {
  margin: 0;
  font-size: 13px;
  color: #94a3b8;
}

.test-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(360px, 1fr));
  gap: 16px;
}

.test-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.card-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.module-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  font-size: 15px;
  color: #f8fafc;
}

.icon {
  font-size: 18px;
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

.btn-secondary {
  background: #0f172a;
  color: #38bdf8;
  border: 1px solid #38bdf8;
  font-family: monospace;
}
.btn-secondary:hover {
  background: #0284c7;
  color: #fff;
}

.test-result {
  background: #0f172a;
  border-radius: 6px;
  padding: 10px 12px;
  border: 1px solid #334155;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.result-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 500;
}

.result-header.success {
  color: #34d399;
}
.result-header.failed {
  color: #f87171;
}

.status-time {
  margin-left: auto;
  font-size: 11px;
  color: #64748b;
}

.details-list {
  margin: 0;
  padding-left: 18px;
  font-size: 12px;
  color: #cbd5e1;
  font-family: monospace;
  line-height: 1.6;
}

.test-placeholder {
  color: #64748b;
  font-size: 12px;
  padding: 8px 0;
}
</style>
