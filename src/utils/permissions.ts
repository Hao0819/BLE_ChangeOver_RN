import { PermissionsAndroid, Platform } from 'react-native';
import { bleManager } from '../ble/bleManager';

export async function requestBlePermissions(): Promise<boolean> {
  if (Platform.OS !== 'android') {
    return true;
  }

  if (Platform.Version >= 31) {
    const results = await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    ]);

    return (
      results[PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN] === PermissionsAndroid.RESULTS.GRANTED &&
      results[PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT] === PermissionsAndroid.RESULTS.GRANTED &&
      results[PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION] === PermissionsAndroid.RESULTS.GRANTED
    );
  }

  const fineLocation = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
  );

  return fineLocation === PermissionsAndroid.RESULTS.GRANTED;
}

export async function isBluetoothPoweredOn(): Promise<boolean> {
  return new Promise(resolve => {
    // 先检查当前状态
    bleManager.getManager().state().then(state => {
      if (state === 'PoweredOn') {
        resolve(true);
        return;
      }
      // 如果还不是 PoweredOn，监听状态变化，等待最多 5 秒
      const timeout = setTimeout(() => {
        subscription.remove();
        resolve(false);
      }, 5000);

      const subscription = bleManager.getManager().onStateChange(newState => {
        if (newState === 'PoweredOn') {
          clearTimeout(timeout);
          subscription.remove();
          resolve(true);
        } else if (newState === 'PoweredOff' || newState === 'Unauthorized') {
          clearTimeout(timeout);
          subscription.remove();
          resolve(false);
        }
      }, true);
    });
  });
}