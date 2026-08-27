import { EventEmitter } from 'events';
import { autoUpdater, UpdateInfo, ProgressInfo } from 'electron-updater';
import { app } from 'electron';

/**
 * 差分自动更新管理器
 * 基于 electron-updater 与 GitHub Releases
 * 支持增量 blockmap 下载、启动自检、用户确认弹窗、后台静默安装
 */
export class UpdateManager extends EventEmitter {
  private isChecking: boolean = false;
  private isDownloading: boolean = false;
  private updateInfo: UpdateInfo | null = null;

  constructor() {
    super();
    this.initAutoUpdater();
  }

  private initAutoUpdater() {
    // 禁用自动静默下载，改为由用户确认后触发差分下载
    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = true;

    // 支持开发模式下测试更新配置
    if (!app.isPackaged) {
      autoUpdater.forceDevUpdateConfig = true;
    }

    // 1. 开始检查更新
    autoUpdater.on('checking-for-update', () => {
      this.isChecking = true;
      this.emit('checking');
    });

    // 2. 检测到新版本
    autoUpdater.on('update-available', (info: UpdateInfo) => {
      this.isChecking = false;
      this.updateInfo = info;
      this.emit('update-available', {
        version: info.version,
        releaseDate: info.releaseDate,
        releaseNotes: info.releaseNotes,
        currentVersion: app.getVersion(),
      });
    });

    // 3. 已经是最新版
    autoUpdater.on('update-not-available', (info: UpdateInfo) => {
      this.isChecking = false;
      this.emit('update-not-available', {
        currentVersion: app.getVersion(),
        latestVersion: info.version,
      });
    });

    // 4. 差分下载进度 (实测百分比与下载速度)
    autoUpdater.on('download-progress', (progressObj: ProgressInfo) => {
      this.emit('download-progress', {
        percent: Math.round(progressObj.percent),
        bytesPerSecond: progressObj.bytesPerSecond,
        transferred: progressObj.transferred,
        total: progressObj.total,
      });
    });

    // 5. 差分包下载完成，准备安装
    autoUpdater.on('update-downloaded', (info: UpdateInfo) => {
      this.isDownloading = false;
      this.emit('update-downloaded', {
        version: info.version,
      });
    });

    // 6. 异常处理
    autoUpdater.on('error', (err: Error) => {
      this.isChecking = false;
      this.isDownloading = false;
      console.error('[UpdateManager] 检查/更新失败:', err.message);
      this.emit('error', err.message);
    });
  }

  /**
   * 手动或启动时检测更新
   */
  public async checkForUpdates(): Promise<{ success: boolean; message?: string }> {
    if (this.isChecking || this.isDownloading) {
      return { success: false, message: '正在检查更新或下载中...' };
    }

    try {
      await autoUpdater.checkForUpdates();
      return { success: true };
    } catch (err: any) {
      console.warn('[UpdateManager] 无法连接到 GitHub 检查更新:', err.message);
      return { success: false, message: err.message };
    }
  }

  /**
   * 启动差分下载
   */
  public async startDownload(): Promise<{ success: boolean; message?: string }> {
    if (this.isDownloading) {
      return { success: false, message: '已经在下载中' };
    }

    this.isDownloading = true;
    try {
      await autoUpdater.downloadUpdate();
      return { success: true };
    } catch (err: any) {
      this.isDownloading = false;
      return { success: false, message: err.message };
    }
  }

  /**
   * 立即退出并安装新版本
   */
  public installNow(): void {
    // isSilent = false (展示平滑过渡), isForceRunAfter = true (安装完毕自动重启应用)
    autoUpdater.quitAndInstall(false, true);
  }

  public getCurrentVersion(): string {
    return app.getVersion();
  }
}
