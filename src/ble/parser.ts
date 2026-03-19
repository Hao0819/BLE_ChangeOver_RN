import {
  createEmptyDeviceState,
  createEmptySettings,
  createEmptyTelemetry,
  type DeviceSettings,
  type DeviceState,
  type DeviceTelemetry,
} from '../types/device';

const STATUS_HEADER = 0xab;   // 171
const SETTING_HEADER = 0xad;

function toVolts(lsb: number, msb: number): number {
  return (lsb + msb * 256) / 10.0;
}

function toAmps(lsb: number, msb: number): number {
  return (lsb + msb * 256) / 100.0;
}

export function bytesToHex(bytes: number[]): string {
  return bytes.map(byte => byte.toString(16).padStart(2, '0').toUpperCase()).join(' ');
}

export function hexToBytes(hex: string): number[] {
  return hex
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map(part => parseInt(part, 16) & 0xff);
}

export function getHeaderFromBytes(bytes: number[]): number {
  if (!bytes.length) {
    return 0;
  }
  return bytes[0] ?? 0;
}

export function parseTelemetry(bytes: number[]): DeviceTelemetry | null {
  if (!bytes.length || bytes[0] !== STATUS_HEADER) {
    return null;
  }

  // 原 Java:
  // 长度 14: 有 Vout
  // 其他: 没有 Vout
  if (bytes.length >= 14) {
    return {
      ch1Voltage: toVolts(bytes[2], bytes[3]),
      ch2Voltage: toVolts(bytes[4], bytes[5]),
      ch3Voltage: toVolts(bytes[6], bytes[7]),
      vout: toVolts(bytes[8], bytes[9]),
      current: toAmps(bytes[10], bytes[11]),
      channel: bytes[12] ?? 0,
      overCurrent: bytes[13] ?? 0,
    };
  }

  if (bytes.length >= 12) {
    return {
      ch1Voltage: toVolts(bytes[2], bytes[3]),
      ch2Voltage: toVolts(bytes[4], bytes[5]),
      ch3Voltage: toVolts(bytes[6], bytes[7]),
      vout: 0,
      current: toAmps(bytes[8], bytes[9]),
      channel: bytes[10] ?? 0,
      overCurrent: bytes[11] ?? 0,
    };
  }

  return null;
}

export function parseSettings(bytes: number[]): DeviceSettings | null {
  if (!bytes.length || bytes[0] !== SETTING_HEADER) {
    return null;
  }

  // ✅ 加这行，看看收到的数据长度和内容
  console.log('[Parser] parseSettings bytes length:', bytes.length, 'hex:', bytesToHex(bytes));

  if (bytes.length < 26) {
    console.log('[Parser] parseSettings too short, got:', bytes.length);
    return null;
  }

  return {
    switchingDelay: toVolts(bytes[2], bytes[3]),
    cutoffPeriod: toVolts(bytes[4], bytes[5]),
    threshold: toVolts(bytes[6], bytes[7]),
    ch1MaxVolts: toVolts(bytes[8], bytes[9]),
    ch1MinVolts: toVolts(bytes[10], bytes[11]),
    ch1MaxAmp: toAmps(bytes[12], bytes[13]),
    ch2MaxVolts: toVolts(bytes[14], bytes[15]),
    ch2MinVolts: toVolts(bytes[16], bytes[17]),
    ch2MaxAmp: toAmps(bytes[18], bytes[19]),
    ch3MaxVolts: toVolts(bytes[20], bytes[21]),
    ch3MinVolts: toVolts(bytes[22], bytes[23]),
    ch3MaxAmp: toAmps(bytes[24], bytes[25]),
  };
}

export function parseIncomingPacket(bytes: number[], prev?: DeviceState): DeviceState {
  const state = prev ?? createEmptyDeviceState();
  const header = getHeaderFromBytes(bytes);
  const hex = bytesToHex(bytes);

  if (header === STATUS_HEADER) {
    const telemetry = parseTelemetry(bytes);
    if (!telemetry) {
      return state;
    }

    return {
      ...state,
      telemetry,
      rawDataHex: hex,
    };
  }

  if (header === SETTING_HEADER) {
    const settings = parseSettings(bytes);
    if (!settings) {
      return state;
    }

    return {
      ...state,
      settings,
      rawSettingHex: hex,
    };
  }

  return state;
}

export function clearDeviceState(): DeviceState {
  return {
    telemetry: createEmptyTelemetry(),
    settings: createEmptySettings(),
    rawDataHex: 'no data',
    rawSettingHex: 'no data',
  };
}