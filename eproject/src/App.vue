<template>
  <div class="app-shell">
    <!-- 顶部主导航栏 -->
    <header class="app-header">
      <div class="brand">
        <span class="logo">👓</span>
        <div class="brand-text">
          <h1>Smart Glass Debug Console</h1>
          <span class="sub">Seeed Studio XIAO ESP32-S3 Sense 联调控制台</span>
        </div>
      </div>

      <!-- 导航选项卡 -->
      <nav class="nav-tabs">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          :class="['nav-tab', { active: currentTab === tab.id }]"
          @click="currentTab = tab.id"
        >
          <span class="tab-icon">{{ tab.icon }}</span>
          <span class="tab-label">{{ tab.name }}</span>
        </button>
      </nav>
    </header>

    <!-- 核心视图区域 -->
    <main class="main-content">
      <keep-alive>
        <component :is="currentViewComponent" />
      </keep-alive>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import SerialView from './views/SerialView.vue';
import StatusView from './views/StatusView.vue';
import HardwareTestView from './views/HardwareTestView.vue';
import CameraView from './views/CameraView.vue';
import AudioView from './views/AudioView.vue';

const currentTab = ref('serial');
const hasNewPhoto = ref(false);

const tabs = computed(() => [
  { id: 'serial', name: 'ESP32 串口', icon: '⚡' },
  { id: 'status', name: '设备状态', icon: '📊' },
  { id: 'test', name: '硬件测试', icon: '🧪' },
  { id: 'camera', name: hasNewPhoto.value ? 'Camera (有新照片!)' : 'Camera', icon: '📷' },
  { id: 'audio', name: 'Microphone', icon: '🎙️' },
]);

let unsubPhoto: (() => void) | null = null;

onMounted(() => {
  if (window.electronAPI && window.electronAPI.camera) {
    unsubPhoto = window.electronAPI.camera.onPhoto(() => {
      currentTab.value = 'camera';
      hasNewPhoto.value = true;
      setTimeout(() => {
        hasNewPhoto.value = false;
      }, 5000);
    });
  }
});

onUnmounted(() => {
  if (unsubPhoto) unsubPhoto();
});

const currentViewComponent = computed(() => {
  switch (currentTab.value) {
    case 'serial':
      return SerialView;
    case 'status':
      return StatusView;
    case 'test':
      return HardwareTestView;
    case 'camera':
      return CameraView;
    case 'audio':
      return AudioView;
    default:
      return SerialView;
  }
});
</script>

<style>
/* 全局暗色系重置 */
* {
  box-sizing: border-box;
}

body {
  margin: 0;
  padding: 0;
  background-color: #0f172a;
  color: #f8fafc;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  user-select: none;
  overflow: hidden;
  height: 100vh;
}

#app {
  height: 100vh;
}
</style>

<style scoped>
.app-shell {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #0f172a;
}

.app-header {
  height: 56px;
  background: #1e293b;
  border-bottom: 1px solid #334155;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  flex-shrink: 0;
}

.brand {
  display: flex;
  align-items: center;
  gap: 12px;
}

.logo {
  font-size: 24px;
}

.brand-text h1 {
  margin: 0;
  font-size: 15px;
  font-weight: 700;
  color: #f8fafc;
  letter-spacing: 0.5px;
}

.sub {
  font-size: 11px;
  color: #94a3b8;
}

.nav-tabs {
  display: flex;
  gap: 6px;
  background: #0f172a;
  padding: 4px;
  border-radius: 6px;
  border: 1px solid #334155;
}

.nav-tab {
  background: none;
  border: none;
  color: #94a3b8;
  padding: 6px 14px;
  border-radius: 4px;
  font-size: 13px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
  transition: all 0.15s ease;
  font-weight: 500;
}

.nav-tab:hover {
  color: #e2e8f0;
  background: #1e293b;
}

.nav-tab.active {
  background: #0284c7;
  color: #ffffff;
}

.tab-icon {
  font-size: 14px;
}

.main-content {
  flex: 1;
  padding: 16px;
  overflow: hidden;
}
</style>
