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
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);
