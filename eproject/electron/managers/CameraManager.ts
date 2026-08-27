/**
 * CameraManager.ts
 * 负责智能眼镜摄像头管理与通信接口 (OV2640)
 */

import { EventEmitter } from 'events';

export interface CameraState {
  model: string;
  status: 'ready' | 'not_ready' | 'streaming' | 'error';
  resolution: string;
  fps: number;
  lastCaptureTime?: string;
  error?: string;
}

export class CameraManager extends EventEmitter {
  private state: CameraState = {
    model: 'OV2640 (Seeed XIAO Sense DVP)',
    status: 'ready',
    resolution: '800x600 (SVGA)',
    fps: 15,
  };

  public getState(): CameraState {
    return { ...this.state };
  }

  public setStreaming(isStreaming: boolean) {
    this.state.status = isStreaming ? 'streaming' : 'ready';
    this.emit('state-changed', this.getState());
  }

  public setError(errMsg: string) {
    this.state.status = 'error';
    this.state.error = errMsg;
    this.emit('state-changed', this.getState());
  }
}
