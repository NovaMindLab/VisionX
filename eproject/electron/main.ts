/**
 * main.ts
 * Electron 主进程入口，初始化各硬件管理模块与 IPC 路由
 */

import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'path';
import fs from 'fs';

import { SerialManager } from './managers/SerialManager';
import { CameraManager } from './managers/CameraManager';
import { AudioManager } from './managers/AudioManager';
import { DisplayManager } from './managers/DisplayManager';
import { DeviceManager } from './managers/DeviceManager';
import { ProtocolManager } from './managers/ProtocolManager';
import { UpdateManager } from './managers/UpdateManager';

let mainWindow: BrowserWindow | null = null;

// 初始化各个管理模块
const serialManager = new SerialManager();
const cameraManager = new CameraManager();
const audioManager = new AudioManager();
const displayManager = new DisplayManager();
const deviceManager = new DeviceManager(serialManager, cameraManager, audioManager, displayManager);
const protocolManager = new ProtocolManager();
const updateManager = new UpdateManager();

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 850,
    minWidth: 1024,
    minHeight: 680,
    title: 'Smart Glass Debug Console',
    icon: path.join(__dirname, '../build/icon.png'),
    backgroundColor: '#0f172a',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  const prodIndex = path.join(__dirname, '../dist/index.html');

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else if (fs.existsSync(prodIndex)) {
    mainWindow.loadFile(prodIndex);
  } else {
    mainWindow.loadURL('http://localhost:5173');
  }

  // 转发串口数据至渲染层
  serialManager.on('line', (line: string) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('serial:line', line);
    }
  });

  serialManager.on('status', (status) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('serial:status', status);
    }
  });

  serialManager.on('ports-changed', (ports) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('serial:ports-changed', ports);
    }
  });

  deviceManager.on('status-update', (status) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('device:status-update', status);
    }
  });

  serialManager.on('image', (imgData) => {
    cameraManager.setLastPhoto(imgData);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('camera:photo', imgData);
    }
  });

  serialManager.on('frame', (frameData) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('camera:frame', frameData);
    }
  });

  // 差分自动升级事件转发
  updateManager.on('checking', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('updater:checking');
    }
  });

  updateManager.on('update-available', (info) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('updater:available', info);
    }
  });

  updateManager.on('update-not-available', (info) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('updater:not-available', info);
    }
  });

  updateManager.on('download-progress', (progress) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('updater:progress', progress);
    }
  });

  updateManager.on('update-downloaded', (info) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('updater:downloaded', info);
    }
  });

  updateManager.on('error', (err) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('updater:error', err);
    }
  });

  // 窗口准备好 3 秒后，静默检查是否有新版本发布
  mainWindow.once('ready-to-show', () => {
    setTimeout(() => {
      updateManager.checkForUpdates();
    }, 2500);
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// 注册 IPC Handlers
function setupIpc() {
  // 串口模块
  ipcMain.handle('serial:list-ports', async () => {
    return await serialManager.listPorts();
  });

  ipcMain.handle('serial:connect', async (_e, port: string, baudRate: number) => {
    return await serialManager.connect(port, baudRate);
  });

  ipcMain.handle('serial:disconnect', async () => {
    return await serialManager.disconnect();
  });

  ipcMain.handle('serial:send', async (_e, data: string) => {
    const formatted = protocolManager.formatCommand(data);
    return await serialManager.send(formatted);
  });

  ipcMain.handle('serial:get-status', () => {
    return serialManager.getStatus();
  });

  ipcMain.handle('serial:set-signals', async (_e, signals) => {
    return await serialManager.setSignals(signals);
  });

  // 设备状态与硬件测试
  ipcMain.handle('device:get-status', () => {
    return deviceManager.getUnifiedStatus();
  });

  ipcMain.handle('device:test-hardware', async (_e, moduleName: string) => {
    return await deviceManager.testHardware(moduleName);
  });

  // 摄像头
  ipcMain.handle('camera:get-state', () => {
    return cameraManager.getState();
  });

  ipcMain.handle('camera:get-last-photo', () => {
    return cameraManager.getLastPhoto();
  });

  ipcMain.handle('camera:start', async () => {
    cameraManager.setStreaming(true);
    return await serialManager.send('STREAM_START\r\n');
  });

  ipcMain.handle('camera:stop', async () => {
    cameraManager.setStreaming(false);
    return await serialManager.send('STREAM_STOP\r\n');
  });

  ipcMain.handle('camera:set-resolution', async (_e, resolution: string) => {
    return await serialManager.send(`RES_${resolution.toUpperCase()}\r\n`);
  });

  ipcMain.handle('camera:capture', async () => {
    return await serialManager.send('CAMERA_CAPTURE\r\n');
  });

  ipcMain.handle('camera:save-photo', async (_e, dataUri: string, defaultName = 'smartglass_photo.jpg') => {
    if (!mainWindow) return { success: false };
    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
      title: '保存拍摄照片',
      defaultPath: defaultName,
      filters: [{ name: 'JPEG Image', extensions: ['jpg', 'jpeg'] }],
    });

    if (canceled || !filePath) return { success: false };

    try {
      const base64Data = dataUri.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');
      fs.writeFileSync(filePath, buffer);
      return { success: true, filePath };
    } catch (err: any) {
      return { success: false, message: err.message };
    }
  });

  // 麦克风
  ipcMain.handle('audio:get-state', () => {
    return audioManager.getState();
  });

  ipcMain.handle('audio:start', async () => {
    audioManager.setRecording(true);
    await serialManager.send('AUDIO_START\r\n');
    return { success: true };
  });

  ipcMain.handle('audio:stop', async () => {
    audioManager.setRecording(false);
    await serialManager.send('AUDIO_STOP\r\n');
    return { success: true };
  });

  // 显示屏 (用户确认未安装)
  ipcMain.handle('display:get-state', () => {
    return displayManager.getState();
  });

  ipcMain.handle('display:test', async () => {
    return await displayManager.runTest();
  });

  // 日志保存文件对话框
  ipcMain.handle('app:save-log', async (_e, content: string, defaultName = 'smartglass_serial_log.txt') => {
    if (!mainWindow) return { success: false };
    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
      title: '导出串口日志',
      defaultPath: defaultName,
      filters: [{ name: 'Text Files', extensions: ['txt', 'log'] }],
    });

    if (canceled || !filePath) {
      return { success: false };
    }

    try {
      fs.writeFileSync(filePath, content, 'utf-8');
      return { success: true, filePath };
    } catch (err: any) {
      return { success: false, message: err.message };
    }
  });

  // 差分自动更新 IPC 路由
  ipcMain.handle('updater:check', async () => {
    return await updateManager.checkForUpdates();
  });

  ipcMain.handle('updater:download', async () => {
    return await updateManager.startDownload();
  });

  ipcMain.handle('updater:install', () => {
    updateManager.installNow();
  });

  ipcMain.handle('updater:get-version', () => {
    return updateManager.getCurrentVersion();
  });
}

app.whenReady().then(() => {
  setupIpc();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  serialManager.destroy();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
