export interface BleDeviceItem {
  id: string;
  name: string | null;
  localName?: string | null;
  address?: string | null;
  rssi?: number | null;
  lastSeen?: number;
}

export interface DeviceTelemetry {
  ch1Voltage: number;
  ch2Voltage: number;
  ch3Voltage: number;
  vout: number;
  current: number;
  channel: number;
  overCurrent: number;
}

export interface DeviceSettings {
  switchingDelay: number;
  cutoffPeriod: number;
  threshold: number;

  ch1MaxVolts: number;
  ch1MinVolts: number;
  ch1MaxAmp: number;

  ch2MaxVolts: number;
  ch2MinVolts: number;
  ch2MaxAmp: number;

  ch3MaxVolts: number;
  ch3MinVolts: number;
  ch3MaxAmp: number;
}

export interface DeviceState {
  telemetry: DeviceTelemetry;
  settings: DeviceSettings;
  rawDataHex: string;
  rawSettingHex: string;
}

export function createEmptyTelemetry(): DeviceTelemetry {
  return {
    ch1Voltage: 0,
    ch2Voltage: 0,
    ch3Voltage: 0,
    vout: 0,
    current: 0,
    channel: 0,
    overCurrent: 0,
  };
}

export function createEmptySettings(): DeviceSettings {
  return {
    switchingDelay: 0,
    cutoffPeriod: 0,
    threshold: 0,

    ch1MaxVolts: 0,
    ch1MinVolts: 0,
    ch1MaxAmp: 0,

    ch2MaxVolts: 0,
    ch2MinVolts: 0,
    ch2MaxAmp: 0,

    ch3MaxVolts: 0,
    ch3MinVolts: 0,
    ch3MaxAmp: 0,
  };
}

export function createEmptyDeviceState(): DeviceState {
  return {
    telemetry: createEmptyTelemetry(),
    settings: createEmptySettings(),
    rawDataHex: 'no data',
    rawSettingHex: 'no data',
  };
}