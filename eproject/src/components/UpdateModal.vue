<template>
  <!-- 升级提示与差分下载弹窗 -->
  <div class="update-modal-backdrop" v-if="showModal">
    <div class="update-modal">
      <!-- 头部 -->
      <div class="modal-header">
        <div class="title-group">
          <span class="icon">🚀</span>
          <h3>发现新版本 (New Version Available)</h3>
        </div>
        <button class="btn-close" v-if="!isDownloading" @click="closeModal">×</button>
      </div>

      <!-- 内容区 -->
      <div class="modal-body">
        <div class="version-banner">
          <div class="ver-box current">
            <span class="label">当前版本</span>
            <span class="value">{{ currentVersion }}</span>
          </div>
          <span class="arrow">➔</span>
          <div class="ver-box target">
            <span class="label">最新版本</span>
            <span class="value">{{ newVersion }}</span>
          </div>
        </div>

        <div class="diff-tag">
          <span class="tag-icon">⚡</span>
          <span>采用 Blockmap 差分极速增量升级，仅需下载改动数据块</span>
        </div>

        <!-- 更新日志 -->
        <div class="changelog-area" v-if="releaseNotes">
          <h4>📝 更新说明：</h4>
          <div class="changelog-content" v-html="formattedReleaseNotes"></div>
        </div>

        <!-- 下载进度条 -->
        <div class="download-section" v-if="isDownloading || isDownloaded">
          <div class="progress-info">
            <span v-if="!isDownloaded">正在差分增量下载... {{ downloadPercent }}%</span>
            <span v-else class="download-success">✓ 差分包已下载完成，准备安装！</span>
            <span class="speed" v-if="downloadSpeed > 0 && !isDownloaded">
              {{ (downloadSpeed / (1024 * 1024)).toFixed(2) }} MB/s
            </span>
          </div>

          <div class="progress-bar-bg">
            <div
              class="progress-bar-fill"
              :style="{ width: downloadPercent + '%' }"
              :class="{ completed: isDownloaded }"
            ></div>
          </div>
        </div>

        <!-- 错误提示 -->
        <div class="error-box" v-if="errorMessage">
          <span>⚠️ {{ errorMessage }}</span>
        </div>
      </div>

      <!-- 底部按钮 -->
      <div class="modal-footer">
        <template v-if="!isDownloading && !isDownloaded">
          <button class="btn btn-secondary" @click="closeModal">稍后再说 (Later)</button>
          <button class="btn btn-primary" @click="startDownload">立即差分升级 (Update Now)</button>
        </template>

        <template v-else-if="isDownloading">
          <button class="btn btn-secondary" disabled>正在下载变动块中...</button>
        </template>

        <template v-else-if="isDownloaded">
          <button class="btn btn-success" @click="installNow">
            ✨ 立即重启并完成安装 (Restart & Install)
          </button>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';

const showModal = ref(false);
const currentVersion = ref('1.0.1');
const newVersion = ref('');
const releaseNotes = ref('');
const errorMessage = ref('');

const isDownloading = ref(false);
const isDownloaded = ref(false);
const downloadPercent = ref(0);
const downloadSpeed = ref(0);

const formattedReleaseNotes = computed(() => {
  if (!releaseNotes.value) return '日常功能优化与体验提升。';
  // 简易格式化换行与标点
  return releaseNotes.value.replace(/\n/g, '<br/>');
});

function closeModal() {
  if (!isDownloading.value) {
    showModal.value = false;
  }
}

async function startDownload() {
  isDownloading.value = true;
  errorMessage.value = '';
  const res = await window.electronAPI.updater.download();
  if (!res.success) {
    isDownloading.value = false;
    errorMessage.value = res.message || '启动下载失败';
  }
}

function installNow() {
  window.electronAPI.updater.install();
}

let unsubAvailable: (() => void) | null = null;
let unsubProgress: (() => void) | null = null;
let unsubDownloaded: (() => void) | null = null;
let unsubError: (() => void) | null = null;

onMounted(async () => {
  if (window.electronAPI && window.electronAPI.updater) {
    currentVersion.value = await window.electronAPI.updater.getVersion();

    // 1. 发现新版本
    unsubAvailable = window.electronAPI.updater.onUpdateAvailable((info) => {
      newVersion.value = info.version;
      currentVersion.value = info.currentVersion || currentVersion.value;
      releaseNotes.value = typeof info.releaseNotes === 'string' ? info.releaseNotes : '';
      showModal.value = true;
      isDownloading.value = false;
      isDownloaded.value = false;
      downloadPercent.value = 0;
    });

    // 2. 差分下载进度
    unsubProgress = window.electronAPI.updater.onDownloadProgress((progress) => {
      isDownloading.value = true;
      downloadPercent.value = progress.percent;
      downloadSpeed.value = progress.bytesPerSecond;
    });

    // 3. 下载完成
    unsubDownloaded = window.electronAPI.updater.onUpdateDownloaded(() => {
      isDownloading.value = false;
      isDownloaded.value = true;
      downloadPercent.value = 100;
    });

    // 4. 报错
    unsubError = window.electronAPI.updater.onError((err) => {
      isDownloading.value = false;
      errorMessage.value = `更新出错: ${err}`;
    });
  }
});

onUnmounted(() => {
  if (unsubAvailable) unsubAvailable();
  if (unsubProgress) unsubProgress();
  if (unsubDownloaded) unsubDownloaded();
  if (unsubError) unsubError();
});

defineExpose({
  openModalManually: (info: any) => {
    newVersion.value = info.version;
    showModal.value = true;
  },
});
</script>

<style scoped>
.update-modal-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(15, 23, 42, 0.75);
  backdrop-filter: blur(6px);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 9999;
}

.update-modal {
  width: 480px;
  background: #1e293b;
  border: 1px solid #38bdf8;
  border-radius: 12px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.6);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  animation: popIn 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes popIn {
  from {
    transform: scale(0.92);
    opacity: 0;
  }
  to {
    transform: scale(1);
    opacity: 1;
  }
}

.modal-header {
  padding: 14px 20px;
  border-bottom: 1px solid #334155;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #0f172a;
}

.title-group {
  display: flex;
  align-items: center;
  gap: 10px;
}

.title-group h3 {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: #f8fafc;
}

.btn-close {
  background: none;
  border: none;
  color: #94a3b8;
  font-size: 20px;
  cursor: pointer;
  line-height: 1;
}
.btn-close:hover {
  color: #f8fafc;
}

.modal-body {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.version-banner {
  display: flex;
  align-items: center;
  justify-content: space-around;
  background: #0f172a;
  padding: 12px;
  border-radius: 8px;
  border: 1px solid #334155;
}

.ver-box {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.ver-box .label {
  font-size: 11px;
  color: #64748b;
  margin-bottom: 2px;
}

.ver-box .value {
  font-size: 16px;
  font-weight: 700;
  font-family: monospace;
}

.current .value {
  color: #94a3b8;
}

.target .value {
  color: #38bdf8;
}

.arrow {
  color: #0284c7;
  font-size: 18px;
  font-weight: bold;
}

.diff-tag {
  background: rgba(14, 165, 233, 0.1);
  border: 1px dashed #0284c7;
  border-radius: 6px;
  padding: 8px 12px;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: #38bdf8;
}

.changelog-area {
  background: #0f172a;
  border: 1px solid #334155;
  border-radius: 6px;
  padding: 12px;
  max-height: 140px;
  overflow-y: auto;
}

.changelog-area h4 {
  margin: 0 0 6px 0;
  font-size: 12px;
  color: #cbd5e1;
}

.changelog-content {
  font-size: 12px;
  line-height: 1.5;
  color: #94a3b8;
}

.download-section {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.progress-info {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: #38bdf8;
}

.download-success {
  color: #34d399 !important;
  font-weight: 600;
}

.speed {
  color: #94a3b8;
  font-family: monospace;
}

.progress-bar-bg {
  width: 100%;
  height: 8px;
  background: #0f172a;
  border-radius: 4px;
  overflow: hidden;
  border: 1px solid #334155;
}

.progress-bar-fill {
  height: 100%;
  background: linear-gradient(90deg, #0284c7, #38bdf8);
  transition: width 0.2s ease;
}

.progress-bar-fill.completed {
  background: linear-gradient(90deg, #059669, #34d399);
}

.error-box {
  background: #7f1d1d;
  color: #fca5a5;
  border: 1px solid #ef4444;
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 12px;
}

.modal-footer {
  padding: 14px 20px;
  border-top: 1px solid #334155;
  background: #0f172a;
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.btn {
  padding: 7px 16px;
  border-radius: 6px;
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

.btn-secondary {
  background: #334155;
  color: #f1f5f9;
}
.btn-secondary:hover {
  background: #475569;
}
</style>
