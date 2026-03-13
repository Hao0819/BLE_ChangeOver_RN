import { DEFAULT_SETTINGS, HEADERS } from './uuid';
import type { DeviceSettings } from '../types/device';
import { Buffer } from 'buffer';
export type CommandType =
  | 'CONNECT'
  | 'DISCONNECT'
  | 'READ_CHAR'
  | 'WRITE_CHAR'
  | 'NOTIFY_CHAR';

export interface BleCommand {
  uuid: string;
  value?: number[];
  type: CommandType;
}

export interface SettingsCommandValues {
  SWITCHING_DELAY1?: number;
  SWITCHING_DELAY2?: number;
  CUTOFF_PERIOD1?: number;
  CUTOFF_PERIOD2?: number;
  RESERVED1?: number;
  RESERVED2?: number;

  CH1_MAXVOLT1?: number;
  CH1_MAXVOLT2?: number;
  CH1_MINVOLT1?: number;
  CH1_MINVOLT2?: number;
  CH1_MAXAMP1?: number;
  CH1_MAXAMP2?: number;

  CH2_MAXVOLT1?: number;
  CH2_MAXVOLT2?: number;
  CH2_MINVOLT1?: number;
  CH2_MINVOLT2?: number;
  CH2_MAXAMP1?: number;
  CH2_MAXAMP2?: number;

  CH3_MAXVOLT1?: number;
  CH3_MAXVOLT2?: number;
  CH3_MINVOLT1?: number;
  CH3_MINVOLT2?: number;
  CH3_MAXAMP1?: number;
  CH3_MAXAMP2?: number;
}

function toByte(value: number): number {
  return value & 0xff;
}

function encodeScaled(value: number, scale: number): [number, number] {
  const encoded = Math.round(value * scale);
  const lsb = encoded % 256;
  const msb = Math.floor(encoded / 256);
  return [toByte(lsb), toByte(msb)];
}

export function buildSwitchCommand(channel: number): number[] {
  return [HEADERS.SELECT_HEADER, toByte(channel)];
}

export function buildSettingCommand(): number[] {
  return [HEADERS.SETTING_HEADER, HEADERS.SETTING_COMMAND];
}

export function buildArabicCommand(): number[] {
  return [HEADERS.ARABIC_COMMAND, DEFAULT_SETTINGS.RESERVED1];
}

export function buildArabicTextCommand(text: string): number[] {
  const bytes = Array.from(Buffer.from(text, 'utf8'));
  return [HEADERS.ARABIC_COMMAND, ...bytes];
}

/**
 * 忠实保留你原 Java 的顺序
 * 注意：原始 Java 里第 4/5 字节用的是 CUTOFF_PERIOD1 两次
 * 这里不擅自修正，保持一致
 */
export function buildSettingsCommand(values: SettingsCommandValues = {}): number[] {
  const v = {
    ...DEFAULT_SETTINGS,
    ...values,
  };

  return [
    HEADERS.SETTINGS_HEADER,
    toByte(v.RESERVED1),
    toByte(v.SWITCHING_DELAY1),
    toByte(v.SWITCHING_DELAY2),
    toByte(v.CUTOFF_PERIOD1),
    toByte(v.CUTOFF_PERIOD1),
    toByte(v.RESERVED1),
    toByte(v.RESERVED2),

    toByte(v.CH1_MAXVOLT1),
    toByte(v.CH1_MAXVOLT2),
    toByte(v.CH1_MINVOLT1),
    toByte(v.CH1_MINVOLT2),
    toByte(v.CH1_MAXAMP1),
    toByte(v.CH1_MAXAMP2),

    toByte(v.CH2_MAXVOLT1),
    toByte(v.CH2_MAXVOLT2),
    toByte(v.CH2_MINVOLT1),
    toByte(v.CH2_MINVOLT2),
    toByte(v.CH2_MAXAMP1),
    toByte(v.CH2_MAXAMP2),

    toByte(v.CH3_MAXVOLT1),
    toByte(v.CH3_MAXVOLT2),
    toByte(v.CH3_MINVOLT1),
    toByte(v.CH3_MINVOLT2),
    toByte(v.CH3_MAXAMP1),
    toByte(v.CH3_MAXAMP2),
  ];
}

export function buildSettingsCommandFromHumanValues(settings: DeviceSettings): number[] {
  const [sd1, sd2] = encodeScaled(settings.switchingDelay, 10);
  const [cp1, cp2] = encodeScaled(settings.cutoffPeriod, 10);
  const [th1, th2] = encodeScaled(settings.threshold, 10);

  const [ch1vmax1, ch1vmax2] = encodeScaled(settings.ch1MaxVolts, 10);
  const [ch1vmin1, ch1vmin2] = encodeScaled(settings.ch1MinVolts, 10);
  const [ch1amax1, ch1amax2] = encodeScaled(settings.ch1MaxAmp, 100);

  const [ch2vmax1, ch2vmax2] = encodeScaled(settings.ch2MaxVolts, 10);
  const [ch2vmin1, ch2vmin2] = encodeScaled(settings.ch2MinVolts, 10);
  const [ch2amax1, ch2amax2] = encodeScaled(settings.ch2MaxAmp, 100);

  const [ch3vmax1, ch3vmax2] = encodeScaled(settings.ch3MaxVolts, 10);
  const [ch3vmin1, ch3vmin2] = encodeScaled(settings.ch3MinVolts, 10);
  const [ch3amax1, ch3amax2] = encodeScaled(settings.ch3MaxAmp, 100);

  return [
    HEADERS.SETTINGS_HEADER,
    0,
    sd1,
    sd2,
    cp1,
    cp2,
    th1,
    th2,

    ch1vmax1,
    ch1vmax2,
    ch1vmin1,
    ch1vmin2,
    ch1amax1,
    ch1amax2,

    ch2vmax1,
    ch2vmax2,
    ch2vmin1,
    ch2vmin2,
    ch2amax1,
    ch2amax2,

    ch3vmax1,
    ch3vmax2,
    ch3vmin1,
    ch3vmin2,
    ch3amax1,
    ch3amax2,
  ];
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