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

export interface UnifiedDeviceStatus {
  esp32: {
    connected: boolean;
    chip: string;
    port?: string;
    baudRate?: number;
    mac?: string;
  };
  camera: {
    model: string;
    status: 'ready' | 'not_ready' | 'streaming' | 'error';
    resolution: string;
    fps: number;
    error?: string;
  };
  microphone: {
    model: string;
    status: 'ready' | 'not_ready' | 'recording' | 'error';
    sampleRate: number;
    channels: number;
    currentVolume: number;
    error?: string;
  };
  display: {
    installed: boolean;
    status: 'ready' | 'not_installed' | 'error';
    model: string;
    message?: string;
  };
  wifi: {
    connected: boolean;
    status: 'connected' | 'disconnected' | 'connecting';
    ssid?: string;
    ip?: string;
  };
  bluetooth: {
    enabled: boolean;
    status: 'ready' | 'connected' | 'disabled';
    deviceName?: string;
  };
}

export interface HardwareTestResult {
  module: string;
  success: boolean;
  message: string;
  timestamp: string;
  details?: string[];
}

export interface ElectronAPI {
  serial: {
    listPorts: () => Promise<SerialPortInfo[]>;
    connect: (port: string, baudRate: number) => Promise<{ success: boolean; message?: string }>;
    disconnect: () => Promise<{ success: boolean; message?: string }>;
    send: (data: string) => Promise<{ success: boolean; message?: string }>;
    setSignals: (signals: { dtr?: boolean; rts?: boolean }) => Promise<boolean>;
    onLine: (callback: (line: string) => void) => () => void;
    onStatus: (callback: (status: SerialStatus) => void) => () => void;
    onPortsChanged: (callback: (ports: SerialPortInfo[]) => void) => () => void;
  };
  device: {
    getStatus: () => Promise<UnifiedDeviceStatus>;
    onStatusUpdate: (callback: (status: UnifiedDeviceStatus) => void) => () => void;
    testHardware: (moduleName: string) => Promise<HardwareTestResult>;
  };
  camera: {
    getState: () => Promise<any>;
    start: () => Promise<any>;
    stop: () => Promise<any>;
    capture: () => Promise<any>;
    onPhoto: (callback: (photo: { base64: string; dataUri: string; size: number; time: string }) => void) => () => void;
    onFrame: (callback: (frame: { dataUri: string; size: number; timestamp: number }) => void) => () => void;
    setResolution: (resolution: string) => Promise<any>;
    savePhoto: (dataUri: string, defaultName?: string) => Promise<{ success: boolean; filePath?: string }>;
  };
  audio: {
    getState: () => Promise<any>;
    start: () => Promise<any>;
    stop: () => Promise<any>;
  };
  display: {
    getState: () => Promise<any>;
    runTest: () => Promise<any>;
  };
  app: {
    saveLogToFile: (content: string, defaultName?: string) => Promise<{ success: boolean; filePath?: string }>;
  };
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
