/**
 * SerialManager.ts
 * 负责 ESP32 串口生命周期管理、热插拔探测、数据缓冲与流控
 */

import { SerialPort } from 'serialport';
import { EventEmitter } from 'events';

export interface PortInfo {
  path: string;
  manufacturer?: string;
  serialNumber?: string;
  pnpId?: string;
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

export class SerialManager extends EventEmitter {
  private currentPort: SerialPort | null = null;
  private currentPortPath: string | null = null;
  private currentBaudRate: number = 115200;
  private monitorTimer: NodeJS.Timeout | null = null;
  private knownPorts: string[] = [];
  private rxBuffer: string = '';

  constructor() {
    super();
    this.startHotplugMonitor();
  }

  /**
   * 列出所有系统可用串口，并自动标记识别 ESP32-S3
   */
  public async listPorts(): Promise<PortInfo[]> {
    try {
      const rawPorts = await SerialPort.list();
      return rawPorts.map((p) => {
        const vid = (p.vendorId || '').toUpperCase();
        const pid = (p.productId || '').toUpperCase();
        const name = (p.friendlyName || '') + ' ' + (p.manufacturer || '');

        let isEsp32 = false;
        let modelName = 'Unknown Device';

        // 探测 Espressif 原生 USB (VID: 0x303A, PID: 0x1001 是 ESP32-S3 原生 USB CDC)
        if (vid === '303A') {
          isEsp32 = true;
          if (pid === '1001') {
            modelName = 'Seeed Studio XIAO ESP32-S3 Sense';
          } else {
            modelName = 'Espressif ESP32-S3 Device';
          }
        } else if (name.toLowerCase().includes('esp32') || name.toLowerCase().includes('seeed')) {
          isEsp32 = true;
          modelName = 'ESP32 Device';
        } else if (name.toLowerCase().includes('ch340') || name.toLowerCase().includes('cp210')) {
          isEsp32 = true;
          modelName = 'USB-UART Serial';
        }

        return {
          path: p.path,
          manufacturer: p.manufacturer,
          serialNumber: p.serialNumber,
          pnpId: p.pnpId,
          friendlyName: p.friendlyName,
          vendorId: p.vendorId,
          productId: p.productId,
          isEsp32,
          modelName,
        };
      });
    } catch (err: any) {
      console.error('SerialManager listPorts error:', err);
      return [];
    }
  }

  /**
   * 连接指定端口
   */
  public async connect(path: string, baudRate: number = 115200): Promise<{ success: boolean; message?: string }> {
    if (this.currentPort && this.currentPort.isOpen) {
      if (this.currentPortPath === path) {
        return { success: true, message: 'Already connected' };
      }
      await this.disconnect();
    }

    return new Promise((resolve) => {
      try {
        const port = new SerialPort(
          {
            path,
            baudRate,
            autoOpen: false,
          },
          (err) => {
            if (err) {
              this.emit('status', { connected: false, port: path, error: err.message });
              resolve({ success: false, message: err.message });
            }
          }
        );

        port.open((openErr) => {
          if (openErr) {
            this.emit('status', { connected: false, port: path, error: openErr.message });
            resolve({ success: false, message: openErr.message });
            return;
          }

          this.currentPort = port;
          this.currentPortPath = path;
          this.currentBaudRate = baudRate;
          this.rxBuffer = '';

          // 设置 DTR / RTS，对 ESP32-S3 原生 USB CDC 通信至关重要
          try {
            port.set({ dtr: true, rts: true });
          } catch (e) {
            // Ignored if not supported by hardware
          }

          port.on('data', (chunk: Buffer) => {
            this.handleIncomingData(chunk);
          });

          port.on('error', (portErr) => {
            console.error(`Serial port [${path}] error:`, portErr);
            this.emit('status', { connected: false, port: path, error: portErr.message });
            this.disconnect();
          });

          port.on('close', () => {
            this.emit('status', { connected: false, port: path });
            this.currentPort = null;
            this.currentPortPath = null;
          });

          const status: SerialStatus = { connected: true, port: path, baudRate };
          this.emit('status', status);
          resolve({ success: true });
        });
      } catch (err: any) {
        resolve({ success: false, message: err.message });
      }
    });
  }

  /**
   * 断开连接
   */
  public async disconnect(): Promise<{ success: boolean; message?: string }> {
    if (!this.currentPort) {
      return { success: true };
    }

    return new Promise((resolve) => {
      const p = this.currentPort;
      const path = this.currentPortPath;
      this.currentPort = null;
      this.currentPortPath = null;

      if (p && p.isOpen) {
        p.close((err) => {
          this.emit('status', { connected: false, port: path || undefined });
          if (err) {
            resolve({ success: false, message: err.message });
          } else {
            resolve({ success: true });
          }
        });
      } else {
        this.emit('status', { connected: false });
        resolve({ success: true });
      }
    });
  }

  /**
   * 发送指令或原始字符串
   */
  public async send(data: string): Promise<{ success: boolean; message?: string }> {
    if (!this.currentPort || !this.currentPort.isOpen) {
      return { success: false, message: 'Port is not connected' };
    }

    return new Promise((resolve) => {
      this.currentPort!.write(data, 'utf-8', (err) => {
        if (err) {
          resolve({ success: false, message: err.message });
        } else {
          resolve({ success: true });
        }
      });
    });
  }

  /**
   * 设置 DTR / RTS 控制信号
   */
  public async setSignals(signals: { dtr?: boolean; rts?: boolean }): Promise<boolean> {
    if (!this.currentPort || !this.currentPort.isOpen) return false;
    return new Promise((resolve) => {
      this.currentPort!.set(signals, (err) => {
        resolve(!err);
      });
    });
  }

  /**
   * 获取当前连接状态
   */
  public getStatus(): SerialStatus {
    return {
      connected: !!(this.currentPort && this.currentPort.isOpen),
      port: this.currentPortPath || undefined,
      baudRate: this.currentBaudRate,
    };
  }

  private isReceivingImage: boolean = false;
  private isReceivingFrame: boolean = false;
  private imageBuffer: string = '';
  private frameBuffer: string = '';
  private expectedImageSize: number = 0;
  private expectedFrameSize: number = 0;

  /**
   * 处理流入的二进制数据，按行解析并分发
   */
  private handleIncomingData(chunk: Buffer) {
    const text = chunk.toString('utf-8');
    this.rxBuffer += text;

    const lines = this.rxBuffer.split(/\r?\n/);
    // 保留最后一个可能未完整的片段
    this.rxBuffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      // 1. 探测单张拍照数据帧 (IMG)
      if (trimmed.startsWith('===IMG_START')) {
        this.isReceivingImage = true;
        this.imageBuffer = '';
        const sizeMatch = trimmed.match(/===IMG_START:(\d+)===/);
        this.expectedImageSize = sizeMatch ? parseInt(sizeMatch[1], 10) : 0;
        this.emit('line', `[CAMERA] 开始接收 ESP32 照片数据流 (预计大小: ${this.expectedImageSize || '未知'} 字节)...`);
        continue;
      }

      if (trimmed.startsWith('===IMG_END===')) {
        if (this.isReceivingImage && this.imageBuffer.length > 0) {
          const rawB64 = this.imageBuffer;
          this.emit('image', {
            base64: rawB64,
            dataUri: rawB64.startsWith('data:image') ? rawB64 : `data:image/jpeg;base64,${rawB64}`,
            size: this.expectedImageSize || Math.round((rawB64.length * 3) / 4),
            time: new Date().toLocaleTimeString(),
          });
          this.emit('line', `[CAMERA] ✓ 照片传输完成并解码成功！大小: ${Math.round((rawB64.length * 3) / 4)} 字节`);
        }
        this.isReceivingImage = false;
        this.imageBuffer = '';
        continue;
      }

      if (this.isReceivingImage) {
        this.imageBuffer += trimmed;
        continue;
      }

      // 2. 探测连续视频流数据帧 (FRAME) - 静默高效直通，不刷终端日志
      if (trimmed.startsWith('===FRAME_START')) {
        this.isReceivingFrame = true;
        this.frameBuffer = '';
        const sizeMatch = trimmed.match(/===FRAME_START:(\d+)===/);
        this.expectedFrameSize = sizeMatch ? parseInt(sizeMatch[1], 10) : 0;
        continue;
      }

      if (trimmed.startsWith('===FRAME_END===')) {
        if (this.isReceivingFrame && this.frameBuffer.length > 0) {
          const rawB64 = this.frameBuffer;
          this.emit('frame', {
            dataUri: rawB64.startsWith('data:image') ? rawB64 : `data:image/jpeg;base64,${rawB64}`,
            size: this.expectedFrameSize || Math.round((rawB64.length * 3) / 4),
            timestamp: Date.now(),
          });
        }
        this.isReceivingFrame = false;
        this.frameBuffer = '';
        continue;
      }

      if (this.isReceivingFrame) {
        this.frameBuffer += trimmed;
        continue;
      }

      // 3. 常规串口文本行
      this.emit('line', line);
    }
  }

  /**
   * 自动监测 USB 热插拔
   */
  private startHotplugMonitor() {
    this.monitorTimer = setInterval(async () => {
      try {
        const ports = await this.listPorts();
        const currentPaths = ports.map((p) => p.path).sort();
        const pathsStr = currentPaths.join(',');
        const knownStr = this.knownPorts.join(',');

        if (pathsStr !== knownStr) {
          this.knownPorts = currentPaths;
          this.emit('ports-changed', ports);

          // 如果已连接的端口突然被物理拔出，自动断开
          if (this.currentPortPath && !currentPaths.includes(this.currentPortPath)) {
            console.warn(`Connected port ${this.currentPortPath} was physically unplugged.`);
            await this.disconnect();
          }
        }
      } catch (err) {
        // Ignore background polling errors
      }
    }, 1500);
  }

  /**
   * 销毁资源
   */
  public destroy() {
    if (this.monitorTimer) {
      clearInterval(this.monitorTimer);
      this.monitorTimer = null;
    }
    this.disconnect();
  }
}
