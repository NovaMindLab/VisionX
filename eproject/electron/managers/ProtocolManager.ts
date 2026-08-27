/**
 * ProtocolManager.ts
 * 负责智能眼镜串口通信协议定义与解析
 */

export interface ParsedPacket {
  type: 'log' | 'status' | 'event' | 'response';
  command?: string;
  data?: any;
  raw: string;
}

export class ProtocolManager {
  // 标准化指令定义
  public static readonly Commands = {
    GET_DEVICE_INFO: 'GET_DEVICE_INFO',
    PING: 'PING',
    STATUS: 'STATUS',
    RESTART: 'RESTART',
    CAMERA_START: 'CAMERA_START',
    CAMERA_STOP: 'CAMERA_STOP',
    CAMERA_CAPTURE: 'CAMERA_CAPTURE',
    AUDIO_START: 'AUDIO_START',
    AUDIO_STOP: 'AUDIO_STOP',
    DISPLAY_TEST: 'DISPLAY_TEST',
  };

  /**
   * 格式化待发送指令，支持追加换行符
   */
  public formatCommand(cmd: string, lineEnding: '\r\n' | '\n' | '' = '\r\n'): string {
    const trimmed = cmd.trim();
    return trimmed + lineEnding;
  }

  /**
   * 解析从硬件接收到的文本行
   */
  public parseLine(line: string): ParsedPacket {
    const trimmed = line.trim();

    // 探测 JSON 协议包格式 (如: {"event":"ready","chip":"esp32s3"})
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      try {
        const json = JSON.parse(trimmed);
        return {
          type: 'response',
          command: json.cmd || json.event,
          data: json,
          raw: line,
        };
      } catch {
        // Not valid JSON, fallback to standard log
      }
    }

    // 探测固件自报标志
    if (trimmed.includes('Hello from Seeed Studio XIAO ESP32-S3 Sense')) {
      return {
        type: 'event',
        command: 'BOOT_BANNER',
        data: { model: 'Seeed Studio XIAO ESP32-S3 Sense' },
        raw: line,
      };
    }

    if (trimmed.includes('Camera init') || trimmed.includes('Camera initialized')) {
      return {
        type: 'event',
        command: 'CAMERA_INIT',
        data: { success: !trimmed.includes('failed') },
        raw: line,
      };
    }

    return {
      type: 'log',
      raw: line,
    };
  }
}
