<template>
  <div class="serial-view">
    <!-- 顶部串口连接控制栏 -->
    <div class="control-panel card">
      <div class="panel-row">
        <div class="field-group">
          <label>COM 端口：</label>
          <div class="select-wrapper">
            <select v-model="selectedPort" :disabled="isConnected">
              <option value="" disabled>-- 请选择端口 --</option>
              <option v-for="p in availablePorts" :key="p.path" :value="p.path">
                {{ p.path }} {{ p.modelName ? `(${p.modelName})` : '' }}
              </option>
            </select>
            <button class="btn btn-secondary icon-btn" title="刷新端口列表" @click="refreshPorts" :disabled="isConnected">
              🔄
            </button>
          </div>
        </div>

        <div class="field-group">
          <label>波特率：</label>
          <select v-model.number="selectedBaudRate" :disabled="isConnected">
            <option v-for="b in baudRates" :key="b" :value="b">{{ b }}</option>
          </select>
        </div>

        <div class="field-group action-buttons">
          <button v-if="!isConnected" class="btn btn-primary" @click="handleConnect" :disabled="!selectedPort || isConnecting">
            {{ isConnecting ? '正在连接...' : '⚡ 连接 ESP32' }}
          </button>
          <button v-else class="btn btn-danger" @click="handleDisconnect">
            🔌 断开连接
          </button>
        </div>

        <div class="field-group signals" v-if="isConnected">
          <span class="signal-tag active">DTR: ON</span>
          <span class="signal-tag active">RTS: ON</span>
        </div>

        <div class="status-indicator">
          <span class="dot" :class="{ online: isConnected }"></span>
          <span class="status-text">{{ isConnected ? `已连接 (${connectedPort}@${selectedBaudRate})` : '未连接' }}</span>
        </div>
      </div>

      <!-- 快捷命令栏 -->
      <div class="quick-commands" v-if="isConnected">
        <span class="quick-label">快捷指令:</span>
        <button class="chip" @click="sendCommand('PING')">PING</button>
        <button class="chip" @click="sendCommand('GET_DEVICE_INFO')">GET_DEVICE_INFO</button>
        <button class="chip" @click="sendCommand('STATUS')">STATUS</button>
        <button class="chip" @click="sendCommand('CAMERA_CAPTURE')">📷 拍照</button>
        <button class="chip chip-warn" @click="sendCommand('RESTART')">⚠️ 重启 ESP32</button>
      </div>
    </div>

    <!-- 串口日志主界面 -->
    <div class="log-section card">
      <!-- 日志工具栏 -->
      <div class="log-toolbar">
        <div class="toolbar-left">
          <span class="log-title">实时串口输出</span>
          <span class="counter-badge">{{ filteredLogs.length }} / {{ logs.length }} 行 (上限 2000)</span>
        </div>

        <div class="toolbar-middle">
          <!-- 搜索框 -->
          <div class="search-box">
            <input type="text" v-model="searchKeyword" placeholder="搜索关键词..." />
            <button v-if="searchKeyword" class="clear-search" @click="searchKeyword = ''">✕</button>
          </div>

          <!-- 级别过滤 -->
          <div class="level-tabs">
            <button
              v-for="lvl in levels"
              :key="lvl"
              :class="['level-tab', { active: currentLevel === lvl }]"
              @click="currentLevel = lvl"
            >
              {{ lvl }}
            </button>
          </div>
        </div>

        <div class="toolbar-right">
          <button class="btn btn-outline" :class="{ active: autoScroll }" @click="autoScroll = !autoScroll">
            {{ autoScroll ? '⬇ 锁定滚动' : '⏹ 自由查看' }}
          </button>
          <button class="btn btn-outline" :class="{ active: isPaused }" @click="isPaused = !isPaused">
            {{ isPaused ? '▶ 继续接收' : '⏸ 暂停' }}
          </button>
          <button class="btn btn-outline" @click="copyAllLogs">📋 复制</button>
          <button class="btn btn-outline" @click="exportLogs">💾 导出</button>
          <button class="btn btn-outline btn-clear" @click="clearLogs">🗑 清空</button>
        </div>
      </div>

      <!-- 日志滚动容器 -->
      <div class="log-container" ref="logContainerRef">
        <div v-if="filteredLogs.length === 0" class="empty-state">
          <span v-if="!isConnected">串口未连接。请选择端口并点击“连接 ESP32”开始调试。</span>
          <span v-else-if="logs.length === 0">等待 ESP32 串口数据输入...</span>
          <span v-else>无符合搜索/过滤条件的日志</span>
        </div>

        <div
          v-for="(item, idx) in filteredLogs"
          :key="item.id"
          :class="['log-line', item.level.toLowerCase()]"
        >
          <span class="line-num">{{ idx + 1 }}</span>
          <span class="line-time">{{ item.time }}</span>
          <span class="line-badge" :class="item.level.toLowerCase()">{{ item.level }}</span>
          <span class="line-content" v-html="highlightText(item.raw)"></span>
        </div>
      </div>

      <!-- 发送命令栏 -->
      <div class="send-bar">
        <div class="input-wrapper">
          <input
            type="text"
            v-model="inputCommand"
            placeholder="输入发送命令 (按 Enter 发送，↑ / ↓ 翻阅历史)..."
            :disabled="!isConnected"
            @keydown.enter="handleSend"
            @keydown.up.prevent="prevHistory"
            @keydown.down.prevent="nextHistory"
          />
        </div>

        <div class="line-ending">
          <select v-model="lineEnding">
            <option value="\r\n">\r\n (CRLF)</option>
            <option value="\n">\n (LF)</option>
            <option value="">None</option>
          </select>
        </div>

        <button class="btn btn-primary send-btn" :disabled="!isConnected || !inputCommand.trim()" @click="handleSend">
          发送 ➔
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue';
import type { SerialPortInfo, SerialStatus } from '@/types/electron';

interface LogItem {
  id: number;
  time: string;
  level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG' | 'RX' | 'TX';
  raw: string;
}

const MAX_LOGS = 2000;
const baudRates = [9600, 19200, 38400, 57600, 115200, 230400, 460800, 921600];
const levels = ['ALL', 'INFO', 'WARN', 'ERROR', 'TX'];

const availablePorts = ref<SerialPortInfo[]>([]);
const selectedPort = ref<string>('');
const selectedBaudRate = ref<number>(115200);
const isConnected = ref(false);
const connectedPort = ref<string>('');
const isConnecting = ref(false);

const logs = ref<LogItem[]>([]);
const searchKeyword = ref('');
const currentLevel = ref('ALL');
const autoScroll = ref(true);
const isPaused = ref(false);
const logContainerRef = ref<HTMLElement | null>(null);

const inputCommand = ref('');
const lineEnding = ref<'\r\n' | '\n' | ''>('\r\n');
const cmdHistory = ref<string[]>([]);
let historyIndex = -1;
let logIdCounter = 0;

let unsubscribeLine: (() => void) | null = null;
let unsubscribeStatus: (() => void) | null = null;
let unsubscribePorts: (() => void) | null = null;

// 过滤后的日志列表
const filteredLogs = computed(() => {
  let list = logs.value;
  if (currentLevel.value !== 'ALL') {
    list = list.filter((l) => l.level === currentLevel.value);
  }
  if (searchKeyword.value.trim()) {
    const kw = searchKeyword.value.toLowerCase();
    list = list.filter((l) => l.raw.toLowerCase().includes(kw));
  }
  return list;
});

// 刷新端口列表并智能推荐 ESP32
async function refreshPorts() {
  if (window.electronAPI) {
    const ports = await window.electronAPI.serial.listPorts();
    availablePorts.value = ports;

    // 如果还没有选择端口，优先自动选择识别出的 ESP32-S3
    if (!selectedPort.value && ports.length > 0) {
      const espPort = ports.find((p) => p.isEsp32 || p.vendorId === '303A');
      selectedPort.value = espPort ? espPort.path : ports[0].path;
    }
  }
}

// 连接串口
async function handleConnect() {
  if (!selectedPort.value || isConnecting.value) return;
  isConnecting.value = true;
  try {
    const res = await window.electronAPI.serial.connect(selectedPort.value, selectedBaudRate.value);
    if (!res.success) {
      addLog('ERROR', `连接 ${selectedPort.value} 失败: ${res.message}`);
    }
  } catch (err: any) {
    addLog('ERROR', `连接异常: ${err.message}`);
  } finally {
    isConnecting.value = false;
  }
}

// 断开串口
async function handleDisconnect() {
  await window.electronAPI.serial.disconnect();
}

// 发送指令
async function sendCommand(cmd: string) {
  if (!isConnected.value || !cmd) return;
  addLog('TX', `> ${cmd}`);
  const payload = cmd + lineEnding.value;
  await window.electronAPI.serial.send(payload);
}

function handleSend() {
  const cmd = inputCommand.value.trim();
  if (!cmd) return;
  sendCommand(cmd);
  if (cmdHistory.value[cmdHistory.value.length - 1] !== cmd) {
    cmdHistory.value.push(cmd);
  }
  historyIndex = -1;
  inputCommand.value = '';
}

function prevHistory() {
  if (cmdHistory.value.length === 0) return;
  if (historyIndex === -1) historyIndex = cmdHistory.value.length - 1;
  else if (historyIndex > 0) historyIndex--;
  inputCommand.value = cmdHistory.value[historyIndex] || '';
}

function nextHistory() {
  if (historyIndex === -1) return;
  if (historyIndex < cmdHistory.value.length - 1) {
    historyIndex++;
    inputCommand.value = cmdHistory.value[historyIndex] || '';
  } else {
    historyIndex = -1;
    inputCommand.value = '';
  }
}

// 添加日志（严格控制最大 2000 行限制）
function addLog(level: LogItem['level'], raw: string) {
  if (isPaused.value && level !== 'TX' && level !== 'ERROR') return;

  const now = new Date();
  const time = `${now.getHours().toString().padStart(2, '0')}:${now
    .getMinutes()
    .toString()
    .padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}.${now
    .getMilliseconds()
    .toString()
    .padStart(3, '0')}`;

  logs.value.push({
    id: ++logIdCounter,
    time,
    level,
    raw,
  });

  // 限制缓存数量，超出时丢弃最旧数据防内存暴增
  if (logs.value.length > MAX_LOGS) {
    logs.value.splice(0, logs.value.length - MAX_LOGS);
  }

  if (autoScroll.value) {
    nextTick(() => {
      if (logContainerRef.value) {
        logContainerRef.value.scrollTop = logContainerRef.value.scrollHeight;
      }
    });
  }
}

function clearLogs() {
  logs.value = [];
}

async function copyAllLogs() {
  const text = filteredLogs.value.map((l) => `[${l.time}] [${l.level}] ${l.raw}`).join('\n');
  await navigator.clipboard.writeText(text);
  alert('已复制日志到剪贴板！');
}

async function exportLogs() {
  const text = logs.value.map((l) => `[${l.time}] [${l.level}] ${l.raw}`).join('\n');
  const res = await window.electronAPI.app.saveLogToFile(text, `ESP32_Serial_${selectedPort.value || 'log'}.txt`);
  if (res.success) {
    alert(`日志已保存至：\n${res.filePath}`);
  }
}

function highlightText(text: string): string {
  const kw = searchKeyword.value.trim();
  const escaped = escapeHtml(text);
  if (!kw) return escaped;
  const regex = new RegExp(`(${escapeRegex(kw)})`, 'gi');
  return escaped.replace(regex, '<mark class="hl">$1</mark>');
}

function escapeHtml(str: string) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeRegex(str: string) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// 自动判定日志级别
function parseLevel(line: string): LogItem['level'] {
  const lower = line.toLowerCase();
  if (lower.includes('err') || lower.includes('fail') || lower.includes('rst:0x')) return 'ERROR';
  if (lower.includes('warn')) return 'WARN';
  if (lower.includes('debug')) return 'DEBUG';
  return 'INFO';
}

onMounted(async () => {
  await refreshPorts();

  if (window.electronAPI) {
    // 监听实时数据流
    unsubscribeLine = window.electronAPI.serial.onLine((line: string) => {
      addLog(parseLevel(line), line);
    });

    // 监听连接状态
    unsubscribeStatus = window.electronAPI.serial.onStatus((status: SerialStatus) => {
      isConnected.value = status.connected;
      if (status.connected) {
        connectedPort.value = status.port || '';
        addLog('INFO', `[SYSTEM] 成功连接串口 ${status.port} @ ${status.baudRate} bps`);
      } else {
        addLog('WARN', `[SYSTEM] 串口已断开 ${status.port || ''} ${status.error ? `(${status.error})` : ''}`);
      }
    });

    // 监听 USB 热插拔
    unsubscribePorts = window.electronAPI.serial.onPortsChanged((ports: SerialPortInfo[]) => {
      availablePorts.value = ports;
      addLog('INFO', `[SYSTEM] 检测到 USB 设备插拔变动，当前可用端口: ${ports.map((p) => p.path).join(', ')}`);
    });
  }
});

onUnmounted(() => {
  if (unsubscribeLine) unsubscribeLine();
  if (unsubscribeStatus) unsubscribeStatus();
  if (unsubscribePorts) unsubscribePorts();
});
</script>

<style scoped>
.serial-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  gap: 12px;
}

.card {
  background: #1e293b;
  border-radius: 8px;
  border: 1px solid #334155;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.2);
}

.control-panel {
  padding: 12px 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.panel-row {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}

.field-group {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: #94a3b8;
}

.select-wrapper {
  display: flex;
  align-items: center;
  gap: 4px;
}

select {
  background: #0f172a;
  border: 1px solid #475569;
  color: #f8fafc;
  padding: 6px 10px;
  border-radius: 4px;
  font-size: 13px;
  outline: none;
}

select:focus {
  border-color: #38bdf8;
}

.btn {
  padding: 6px 12px;
  border-radius: 4px;
  border: none;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  transition: all 0.15s ease;
}

.btn-primary {
  background: #0284c7;
  color: #fff;
}
.btn-primary:hover {
  background: #0369a1;
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
  color: #e2e8f0;
}
.btn-secondary:hover {
  background: #475569;
}

.btn-outline {
  background: transparent;
  border: 1px solid #475569;
  color: #cbd5e1;
}
.btn-outline:hover,
.btn-outline.active {
  background: #334155;
  color: #38bdf8;
  border-color: #38bdf8;
}

.btn-clear:hover {
  color: #f87171;
  border-color: #f87171;
}

.icon-btn {
  padding: 6px 8px;
}

.signal-tag {
  font-size: 11px;
  background: #064e3b;
  color: #34d399;
  padding: 2px 6px;
  border-radius: 3px;
  border: 1px solid #059669;
}

.status-indicator {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: #cbd5e1;
}

.dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #64748b;
}
.dot.online {
  background: #22c55e;
  box-shadow: 0 0 8px #22c55e;
}

.quick-commands {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  padding-top: 6px;
  border-top: 1px dashed #334155;
}

.quick-label {
  color: #64748b;
}

.chip {
  background: #0f172a;
  border: 1px solid #334155;
  color: #38bdf8;
  padding: 3px 8px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  font-family: monospace;
}
.chip:hover {
  background: #1e3a8a;
  border-color: #60a5fa;
}
.chip-warn {
  color: #fbbf24;
}
.chip-warn:hover {
  background: #78350f;
  border-color: #f59e0b;
}

/* 日志板块 */
.log-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.log-toolbar {
  padding: 8px 16px;
  background: #0f172a;
  border-bottom: 1px solid #334155;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.toolbar-left,
.toolbar-middle,
.toolbar-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.log-title {
  font-weight: 600;
  font-size: 14px;
  color: #f1f5f9;
}

.counter-badge {
  font-size: 11px;
  color: #64748b;
  background: #1e293b;
  padding: 2px 6px;
  border-radius: 4px;
}

.search-box {
  position: relative;
  display: flex;
  align-items: center;
}

.search-box input {
  background: #1e293b;
  border: 1px solid #334155;
  color: #fff;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  width: 140px;
}

.clear-search {
  position: absolute;
  right: 6px;
  background: none;
  border: none;
  color: #64748b;
  cursor: pointer;
  font-size: 10px;
}

.level-tabs {
  display: flex;
  background: #1e293b;
  border-radius: 4px;
  padding: 2px;
  border: 1px solid #334155;
}

.level-tab {
  background: none;
  border: none;
  color: #94a3b8;
  padding: 2px 8px;
  font-size: 11px;
  cursor: pointer;
  border-radius: 3px;
}

.level-tab.active {
  background: #0284c7;
  color: #fff;
}

/* 滚动日志容器 */
.log-container {
  flex: 1;
  overflow-y: auto;
  background: #090d16;
  font-family: 'Consolas', 'Courier New', monospace;
  font-size: 12px;
  padding: 8px 12px;
  line-height: 1.5;
}

.empty-state {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100%;
  color: #475569;
  font-size: 13px;
}

.log-line {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 2px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.02);
}

.log-line:hover {
  background: rgba(255, 255, 255, 0.04);
}

.line-num {
  color: #334155;
  width: 35px;
  text-align: right;
  user-select: none;
  font-size: 11px;
}

.line-time {
  color: #475569;
  font-size: 11px;
  user-select: none;
}

.line-badge {
  font-size: 10px;
  padding: 1px 4px;
  border-radius: 3px;
  user-select: none;
  font-weight: 600;
}

.line-badge.info {
  background: #1e3a8a;
  color: #60a5fa;
}
.line-badge.warn {
  background: #78350f;
  color: #fbbf24;
}
.line-badge.error {
  background: #7f1d1d;
  color: #f87171;
}
.line-badge.debug {
  background: #312e81;
  color: #a5b4fc;
}
.line-badge.tx {
  background: #065f46;
  color: #34d399;
}

.line-content {
  color: #cbd5e1;
  word-break: break-all;
  white-space: pre-wrap;
  flex: 1;
}

.log-line.warn .line-content {
  color: #fef08a;
}
.log-line.error .line-content {
  color: #fca5a5;
}
.log-line.tx .line-content {
  color: #6ee7b7;
}

:deep(mark.hl) {
  background: #eab308;
  color: #000;
  border-radius: 2px;
  padding: 0 2px;
}

/* 底部发送控制 */
.send-bar {
  padding: 8px 12px;
  background: #0f172a;
  border-top: 1px solid #334155;
  display: flex;
  align-items: center;
  gap: 8px;
}

.input-wrapper {
  flex: 1;
}

.input-wrapper input {
  width: 100%;
  background: #1e293b;
  border: 1px solid #475569;
  color: #f8fafc;
  padding: 7px 12px;
  border-radius: 4px;
  font-size: 13px;
  font-family: monospace;
  outline: none;
}

.input-wrapper input:focus {
  border-color: #38bdf8;
}

.send-btn {
  padding: 7px 16px;
}
</style>
