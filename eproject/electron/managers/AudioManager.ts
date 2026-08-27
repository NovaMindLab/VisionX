/**
 * AudioManager.ts
 * 负责智能眼镜麦克风管理与通信接口 (PDM 麦克风)
 */

import { EventEmitter } from 'events';

export interface AudioState {
  model: string;
  status: 'ready' | 'not_ready' | 'recording' | 'error';
  sampleRate: number;
  channels: number;
  currentVolume: number;
  error?: string;
}

export class AudioManager extends EventEmitter {
  private state: AudioState = {
    model: 'MSM261D3526H1CPM (Digital PDM Mic, GPIO 41/42)',
    status: 'ready',
    sampleRate: 16000,
    channels: 1,
    currentVolume: 0,
  };

  public getState(): AudioState {
    return { ...this.state };
  }

  public setRecording(isRecording: boolean) {
    this.state.status = isRecording ? 'recording' : 'ready';
    this.emit('state-changed', this.getState());
  }

  public setVolume(vol: number) {
    this.state.currentVolume = Math.min(100, Math.max(0, vol));
    this.emit('volume', this.state.currentVolume);
  }
}
