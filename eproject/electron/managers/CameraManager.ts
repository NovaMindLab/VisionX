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

export interface PhotoData {
  base64: string;
  dataUri: string;
  size: number;
  time: string;
}

export class CameraManager extends EventEmitter {
  private state: CameraState = {
    model: 'OV2640 (Seeed XIAO Sense DVP)',
    status: 'ready',
    resolution: '800x600 (SVGA)',
    fps: 15,
  };

  private lastPhoto: PhotoData | null = null;

  public getState(): CameraState {
    return { ...this.state };
  }

  public setLastPhoto(photo: PhotoData) {
    this.lastPhoto = photo;
    this.state.lastCaptureTime = photo.time;
    this.emit('photo-captured', photo);
  }

  public getLastPhoto(): PhotoData | null {
    return this.lastPhoto;
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
