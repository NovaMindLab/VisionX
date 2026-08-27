/**
 * preload.ts
 * 负责渲染进程与主进程之间的安全桥接 API
 */

import { contextBridge, ipcRenderer } from 'electron';

export interface SerialPortInfo {
  path: string;
  manufacturer?: string;
  serialNumber?: string;
  friendlyName?: string;
  vendorId?: string;
  productId?: string;
  isEsp32?: boolean;
  modelName?: string;
}

export interface SerialStatus {
  connected: boolean;
  port?: string;
  baudRate?: number;
  error?: string;
}

const electronAPI = {
  serial: {
    listPorts: (): Promise<SerialPortInfo[]> => ipcRenderer.invoke('serial:list-ports'),
    connect: (port: string, baudRate: number): Promise<{ success: boolean; message?: string }> =>
      ipcRenderer.invoke('serial:connect', port, baudRate),
    disconnect: (): Promise<{ success: boolean; message?: string }> =>
      ipcRenderer.invoke('serial:disconnect'),
    send: (data: string): Promise<{ success: boolean; message?: string }> =>
      ipcRenderer.invoke('serial:send', data),
    setSignals: (signals: { dtr?: boolean; rts?: boolean }): Promise<boolean> =>
      ipcRenderer.invoke('serial:set-signals', signals),
    getStatus: (): Promise<SerialStatus> => ipcRenderer.invoke('serial:get-status'),
    onLine: (callback: (line: string) => void) => {
      const handler = (_event: any, line: string) => callback(line);
      ipcRenderer.on('serial:line', handler);
      return () => ipcRenderer.removeListener('serial:line', handler);
    },
    onStatus: (callback: (status: SerialStatus) => void) => {
      const handler = (_event: any, status: SerialStatus) => callback(status);
      ipcRenderer.on('serial:status', handler);
      return () => ipcRenderer.removeListener('serial:status', handler);
    },
    onPortsChanged: (callback: (ports: SerialPortInfo[]) => void) => {
      const handler = (_event: any, ports: SerialPortInfo[]) => callback(ports);
      ipcRenderer.on('serial:ports-changed', handler);
      return () => ipcRenderer.removeListener('serial:ports-changed', handler);
    },
  },

  device: {
    getStatus: () => ipcRenderer.invoke('device:get-status'),
    onStatusUpdate: (callback: (status: any) => void) => {
      const handler = (_event: any, status: any) => callback(status);
      ipcRenderer.on('device:status-update', handler);
      return () => ipcRenderer.removeListener('device:status-update', handler);
    },
    testHardware: (moduleName: string) => ipcRenderer.invoke('device:test-hardware', moduleName),
  },

  camera: {
    getState: () => ipcRenderer.invoke('camera:get-state'),
    getLastPhoto: (): Promise<{ base64: string; dataUri: string; size: number; time: string } | null> =>
      ipcRenderer.invoke('camera:get-last-photo'),
    start: () => ipcRenderer.invoke('camera:start'),
    stop: () => ipcRenderer.invoke('camera:stop'),
    capture: () => ipcRenderer.invoke('camera:capture'),
    onPhoto: (callback: (photo: { base64: string; dataUri: string; size: number; time: string }) => void) => {
      const handler = (_event: any, photo: any) => callback(photo);
      ipcRenderer.on('camera:photo', handler);
      return () => ipcRenderer.removeListener('camera:photo', handler);
    },
    onFrame: (callback: (frame: { dataUri: string; size: number; timestamp: number }) => void) => {
      const handler = (_event: any, frame: any) => callback(frame);
      ipcRenderer.on('camera:frame', handler);
      return () => ipcRenderer.removeListener('camera:frame', handler);
    },
    setResolution: (resolution: string) => ipcRenderer.invoke('camera:set-resolution', resolution),
    savePhoto: (dataUri: string, defaultName?: string): Promise<{ success: boolean; filePath?: string }> =>
      ipcRenderer.invoke('camera:save-photo', dataUri, defaultName),
  },

  audio: {
    getState: () => ipcRenderer.invoke('audio:get-state'),
    start: () => ipcRenderer.invoke('audio:start'),
    stop: () => ipcRenderer.invoke('audio:stop'),
  },

  display: {
    getState: () => ipcRenderer.invoke('display:get-state'),
    runTest: () => ipcRenderer.invoke('display:test'),
  },

  app: {
    saveLogToFile: (content: string, defaultName?: string): Promise<{ success: boolean; filePath?: string }> =>
      ipcRenderer.invoke('app:save-log', content, defaultName),
  },

  updater: {
    check: () => ipcRenderer.invoke('updater:check'),
    download: () => ipcRenderer.invoke('updater:download'),
    install: () => ipcRenderer.invoke('updater:install'),
    getVersion: () => ipcRenderer.invoke('updater:get-version'),
    onChecking: (cb: () => void) => {
      const handler = () => cb();
      ipcRenderer.on('updater:checking', handler);
      return () => ipcRenderer.removeListener('updater:checking', handler);
    },
    onUpdateAvailable: (cb: (info: any) => void) => {
      const handler = (_e: any, info: any) => cb(info);
      ipcRenderer.on('updater:available', handler);
      return () => ipcRenderer.removeListener('updater:available', handler);
    },
    onUpdateNotAvailable: (cb: (info: any) => void) => {
      const handler = (_e: any, info: any) => cb(info);
      ipcRenderer.on('updater:not-available', handler);
      return () => ipcRenderer.removeListener('updater:not-available', handler);
    },
    onDownloadProgress: (cb: (progress: any) => void) => {
      const handler = (_e: any, progress: any) => cb(progress);
      ipcRenderer.on('updater:progress', handler);
      return () => ipcRenderer.removeListener('updater:progress', handler);
    },
    onUpdateDownloaded: (cb: (info: any) => void) => {
      const handler = (_e: any, info: any) => cb(info);
      ipcRenderer.on('updater:downloaded', handler);
      return () => ipcRenderer.removeListener('updater:downloaded', handler);
    },
    onError: (cb: (err: string) => void) => {
      const handler = (_e: any, err: string) => cb(err);
      ipcRenderer.on('updater:error', handler);
      return () => ipcRenderer.removeListener('updater:error', handler);
    },
  },
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);
