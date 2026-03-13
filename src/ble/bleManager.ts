import { BleManager, Device, Subscription } from 'react-native-ble-plx';
import { Buffer } from 'buffer';
import { UUIDS } from './uuid';
import type { BleCommand, CommandType } from './commands';

type ScanOptions = {
  allowDuplicates?: boolean;
  nameFilter?: string;
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

  startScan(
    onDeviceFound: (device: Device) => void,
    onError?: ErrorCallback,
    options?: ScanOptions,
  ): void {
    const allowDuplicates = options?.allowDuplicates ?? false;
    const nameFilter = options?.nameFilter?.trim().toLowerCase();

    this.manager.startDeviceScan(
      null,
      { allowDuplicates },
      (error, device) => {
        if (error) {
          onError?.(error);
          return;
        }

        if (!device) {
          return;
        }

        if (nameFilter) {
          const deviceName = (device.name ?? device.localName ?? '').toLowerCase();
          if (!deviceName.includes(nameFilter)) {
            return;
          }
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

  // ✅ 加这个新方法
  async writeBleDataWithoutResponse(value: number[]): Promise<void> {
    await this.writeCharacteristicWithoutResponse(UUIDS.BLE_DATA, value);
  }


  // Fixed: added delay + retry mechanism to handle GATT_ERROR 133 on Android
  async connect(deviceId: string, retries = 3): Promise<Device> {
    console.log('[BLE] connect start:', deviceId);

    // Stop scanning first
    this.stopScan();

    // Wait for BLE stack to fully stop scanning before connecting
    // This prevents race condition that causes errorCode: 2
    await new Promise<void>(resolve => setTimeout(() => resolve(), 600));

    this.removeNotifySubscription();
    this.removeDisconnectSubscription();

    // Clean up existing connection if any
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

    // Retry loop
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        console.log(`[BLE] connect attempt ${attempt}/${retries}`);

        const connected = await this.manager.connectToDevice(deviceId, {
          timeout: 15000,
          autoConnect: false,
        });

        console.log('[BLE] connected:', connected.id);

        // Wait before discovering services to avoid Android GATT_ERROR 133
        // The GATT layer needs time to fully initialize after connection
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

        // All retries exhausted, throw the error
        if (attempt === retries) {
          console.log('[BLE] connect failed after all retries:', JSON.stringify(error, null, 2));
          this.connectedDevice = null;
          this.removeNotifySubscription();
          this.removeDisconnectSubscription();
          throw error;
        }

        // Wait before retrying to give the device time to reset
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