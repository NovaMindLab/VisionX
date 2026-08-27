/**
 * DisplayManager.ts
 * 负责智能眼镜显示屏状态与联调管理
 * 用户已确认：当前硬件未安装外接屏幕
 */

export interface DisplayState {
  installed: boolean;
  status: 'ready' | 'not_installed' | 'error';
  model: string;
  resolution?: string;
  brightness?: number;
  fps?: number;
  message?: string;
}

export class DisplayManager {
  private state: DisplayState = {
    installed: false,
    status: 'not_installed',
    model: 'None (No screen attached)',
    message: 'User confirmed no external display hardware is installed on smart glass.',
  };

  public getState(): DisplayState {
    return { ...this.state };
  }

  public async runTest(): Promise<{ success: boolean; message: string }> {
    return {
      success: false,
      message: 'No display hardware installed. Display test skipped.',
    };
  }
}
