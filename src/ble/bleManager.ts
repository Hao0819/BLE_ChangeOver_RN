import { BleManager, Device, Subscription } from 'react-native-ble-plx';
import { Buffer } from 'buffer';
import { UUIDS } from './uuid';
import type { BleCommand, CommandType } from './commands';

// ✅ 改掉 nameFilter，改用 serviceUUIDs
type ScanOptions = {
  allowDuplicates?: boolean;
  serviceUUIDs?: string[] | null;
};

type NotifyCallback = (data: { bytes: number[]; hex: string }) => void;
type ErrorCallback = (error: unknown) => void;

class BleServiceManager {
  private manager: BleManager;
  private connectedDevice: Device | null = null;
  private notifySubscription: Subscription | null = null;
  private disconnectSubscription: Subscription | null = null;

  private queue: BleCommand[] = [];
  private processing = false;

  constructor() {
    this.manager = new BleManager();
  }

  getManager(): BleManager {
    return this.manager;
  }

  getConnectedDevice(): Device | null {
    return this.connectedDevice;
  }

  getConnectedDeviceId(): string | null {
    return this.connectedDevice?.id ?? null;
  }

  getConnectedDeviceName(): string | null {
    return this.connectedDevice?.name ?? this.connectedDevice?.localName ?? null;
  }

  // ✅ 等待蓝牙 PoweredOn 再扫描
  // iOS 启动后 BLE stack 不是立刻可用，必须等 PoweredOn 才能扫描
  private async waitUntilPoweredOn(timeoutMs = 10000): Promise<void> {
    const currentState = await this.manager.state();
    console.log('[BLE] current state:', currentState);

    if (currentState === 'PoweredOn') {
      return;
    }

    await new Promise<void>((resolve, reject) => {
      let subscription: Subscription | null = null;

      const timer = setTimeout(() => {
        subscription?.remove();
        reject(new Error('Bluetooth is not PoweredOn'));
      }, timeoutMs);

      subscription = this.manager.onStateChange((state) => {
        console.log('[BLE] state changed:', state);

        if (state === 'PoweredOn') {
          clearTimeout(timer);
          subscription?.remove();
          resolve();
        }
      }, true);
    });
  }

  // ✅ 改成 async + 等 PoweredOn + 支持 serviceUUIDs 过滤
  async startScan(
    onDeviceFound: (device: Device) => void,
    onError?: ErrorCallback,
    options?: ScanOptions,
  ): Promise<void> {
    const allowDuplicates = options?.allowDuplicates ?? false;
    const serviceUUIDs = options?.serviceUUIDs ?? null;

    await this.waitUntilPoweredOn();

    this.stopScan();

    console.log('[BLE] startScan:', { allowDuplicates, serviceUUIDs });

    this.manager.startDeviceScan(
      serviceUUIDs,
      { allowDuplicates },
      (error, device) => {
        if (error) {
          onError?.(error);
          return;
        }

        if (!device) {
          return;
        }

        onDeviceFound(device);
      },
    );
  }

  stopScan(): void {
    this.manager.stopDeviceScan();
  }

  private removeNotifySubscription(): void {
    if (this.notifySubscription) {
      this.notifySubscription.remove();
      this.notifySubscription = null;
    }
  }

  private removeDisconnectSubscription(): void {
    if (this.disconnectSubscription) {
      this.disconnectSubscription.remove();
      this.disconnectSubscription = null;
    }
  }

  async isConnected(deviceId?: string): Promise<boolean> {
    const id = deviceId ?? this.connectedDevice?.id;
    if (!id) {
      return false;
    }

    try {
      return await this.manager.isDeviceConnected(id);
    } catch (error) {
      console.log('[BLE] isConnected error:', error);
      return false;
    }
  }

  async writeBleData(value: number[]): Promise<void> {
    await this.writeCharacteristic(UUIDS.BLE_DATA, value);
  }

  async writeBleDataWithoutResponse(value: number[]): Promise<void> {
    await this.writeCharacteristicWithoutResponse(UUIDS.BLE_DATA, value);
  }

  // Fixed: added delay + retry mechanism to handle GATT_ERROR 133 on Android
  async connect(deviceId: string, retries = 3): Promise<Device> {
    console.log('[BLE] connect start:', deviceId);

    this.stopScan();

    await new Promise<void>(resolve => setTimeout(() => resolve(), 600));

    this.removeNotifySubscription();
    this.removeDisconnectSubscription();

    if (this.connectedDevice) {
      try {
        const stillConnected = await this.manager.isDeviceConnected(this.connectedDevice.id);
        if (stillConnected) {
          await this.connectedDevice.cancelConnection();
        }
      } catch (error) {
        console.log('[BLE] cleanup old connection error:', error);
      } finally {
        this.connectedDevice = null;
      }
    }

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        console.log(`[BLE] connect attempt ${attempt}/${retries}`);

        const connected = await this.manager.connectToDevice(deviceId, {
          timeout: 15000,
          autoConnect: false,
        });

        console.log('[BLE] connected:', connected.id);

        await new Promise<void>(resolve => setTimeout(() => resolve(), 500));

        const discovered = await connected.discoverAllServicesAndCharacteristics();

        console.log('[BLE] discovered services/characteristics');

        this.connectedDevice = discovered;

        this.disconnectSubscription = this.manager.onDeviceDisconnected(
          deviceId,
          (error, device) => {
            console.log('[BLE] disconnected callback:', {
              deviceId,
              callbackDeviceId: device?.id,
              error,
            });

            if (this.connectedDevice?.id === deviceId) {
              this.connectedDevice = null;
            }

            this.removeNotifySubscription();
          },
        );

        return discovered;

      } catch (error: any) {
        console.log(`[BLE] connect attempt ${attempt} failed:`, error?.message);

        if (attempt === retries) {
          console.log('[BLE] connect failed after all retries:', JSON.stringify(error, null, 2));
          this.connectedDevice = null;
          this.removeNotifySubscription();
          this.removeDisconnectSubscription();
          throw error;
        }

        console.log('[BLE] waiting 1000ms before retry...');
        await new Promise<void>(resolve => setTimeout(() => resolve(), 1000));
      }
    }

    throw new Error('Connection failed after maximum retries');
  }

  async reconnect(deviceId: string): Promise<Device> {
    return this.connect(deviceId);
  }

  async disconnect(): Promise<void> {
    this.removeNotifySubscription();
    this.removeDisconnectSubscription();

    if (!this.connectedDevice) {
      return;
    }

    try {
      const connected = await this.manager.isDeviceConnected(this.connectedDevice.id);
      if (connected) {
        await this.connectedDevice.cancelConnection();
      }
    } catch (error) {
      console.log('[BLE] disconnect error:', error);
    } finally {
      this.connectedDevice = null;
    }
  }

  async destroy(): Promise<void> {
    await this.disconnect();
    this.manager.destroy();
  }

  async readCharacteristic(uuid: string): Promise<number[] | null> {
    if (!this.connectedDevice) {
      throw new Error('No connected device');
    }

    const characteristic = await this.connectedDevice.readCharacteristicForService(
      UUIDS.CUSTOM_SERVICE,
      uuid,
    );

    if (!characteristic.value) {
      return null;
    }

    return Array.from(Buffer.from(characteristic.value, 'base64'));
  }

  async writeCharacteristic(uuid: string, value: number[]): Promise<void> {
    if (!this.connectedDevice) {
      throw new Error('No connected device');
    }

    const base64Value = Buffer.from(value).toString('base64');

    await this.connectedDevice.writeCharacteristicWithResponseForService(
      UUIDS.CUSTOM_SERVICE,
      uuid,
      base64Value,
    );
  }

  async writeCharacteristicWithoutResponse(uuid: string, value: number[]): Promise<void> {
    if (!this.connectedDevice) {
      throw new Error('No connected device');
    }

    const base64Value = Buffer.from(value).toString('base64');

    await this.connectedDevice.writeCharacteristicWithoutResponseForService(
      UUIDS.CUSTOM_SERVICE,
      uuid,
      base64Value,
    );
  }

  async readBleData(): Promise<number[] | null> {
    return this.readCharacteristic(UUIDS.BLE_DATA);
  }

  async writeBleSetting(value: number[]): Promise<void> {
    await this.writeCharacteristic(UUIDS.BLE_SETTING, value);
  }

  async writeBleSettingWithoutResponse(value: number[]): Promise<void> {
    await this.writeCharacteristicWithoutResponse(UUIDS.BLE_SETTING, value);
  }

  monitorBleData(onData: NotifyCallback, onError?: ErrorCallback): void {
    if (!this.connectedDevice) {
      throw new Error('No connected device');
    }

    this.removeNotifySubscription();

    this.notifySubscription = this.connectedDevice.monitorCharacteristicForService(
      UUIDS.CUSTOM_SERVICE,
      UUIDS.BLE_DATA,
      (error, characteristic) => {
        if (error) {
          console.log('[BLE] monitor error:', JSON.stringify(error, null, 2));
          onError?.(error);
          return;
        }

        if (!characteristic?.value) {
          return;
        }

        const bytes = Array.from(Buffer.from(characteristic.value, 'base64'));
        const hex = bytes
          .map(byte => byte.toString(16).padStart(2, '0').toUpperCase())
          .join(' ');

        console.log('[BLE] notify:', hex);
        onData({ bytes, hex });
      },
    );
  }

  stopMonitorBleData(): void {
    this.removeNotifySubscription();
  }

  enqueueCommand(command: BleCommand): void {
    this.queue.push(command);
    void this.processQueue();
  }

  clearQueue(): void {
    this.queue = [];
  }

  private async processQueue(): Promise<void> {
    if (this.processing) {
      return;
    }

    this.processing = true;

    try {
      while (this.queue.length > 0) {
        const command = this.queue.shift();
        if (!command) {
          continue;
        }

        await this.executeCommand(command);
      }
    } finally {
      this.processing = false;
    }
  }

  private async executeCommand(command: BleCommand): Promise<void> {
    switch (command.type as CommandType) {
      case 'CONNECT':
        if (!command.uuid) {
          throw new Error('CONNECT command requires device id in uuid field');
        }
        await this.connect(command.uuid);
        break;

      case 'DISCONNECT':
        await this.disconnect();
        break;

      case 'READ_CHAR':
        await this.readCharacteristic(command.uuid);
        break;

      case 'WRITE_CHAR':
        await this.writeCharacteristic(command.uuid, command.value ?? []);
        break;

      case 'NOTIFY_CHAR':
        if (command.uuid !== UUIDS.BLE_DATA) {
          throw new Error(`NOTIFY_CHAR currently supports BLE_DATA only, got: ${command.uuid}`);
        }
        break;

      default:
        throw new Error(`Unsupported command type: ${String(command.type)}`);
    }
  }
}

export const bleManager = new BleServiceManager();
export type { Device };