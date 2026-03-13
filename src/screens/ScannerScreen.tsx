import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  Linking,
  RefreshControl,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types/navigation';
import type { BleDeviceItem } from '../types/device';
import { bleManager } from '../ble/bleManager';
import { requestBlePermissions, isBluetoothPoweredOn } from '../utils/permissions';

type Props = NativeStackScreenProps<RootStackParamList, 'Scanner'>;

const TARGET_DEVICE_NAME = 'MyStarChangeOver';

// EBQ Color Palette — white topbar style
const WHITE      = '#FFFFFF';
const BG         = '#F2F4F7';
const BLUE       = '#1565C0';
const TEXT_DARK  = '#1A1A2E';
const TEXT_LIGHT = '#9AA0AD';
const DIVIDER    = '#E8EAED';
const ICON_BG    = '#E8EEF9';

export default function ScannerScreen({ navigation }: Props) {
  const [devices, setDevices]           = useState<BleDeviceItem[]>([]);
  const [isScanning, setIsScanning]     = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [connectingId, setConnectingId] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const sortedDevices = useMemo(() => {
    return [...devices].sort((a, b) => (b.lastSeen ?? 0) - (a.lastSeen ?? 0));
  }, [devices]);

  const formatRssi = (rssi?: number | null) => {
    if (rssi == null) return '';
    return `${rssi} dBm`;
  };

  const upsertDevice = useCallback((device: BleDeviceItem) => {
    setDevices(prev => {
      const index = prev.findIndex(item => item.id === device.id);
      if (index >= 0) {
        const next = [...prev];
        next[index] = { ...next[index], ...device };
        return next;
      }
      return [...prev, device];
    });
  }, []);

  const stopScanning = useCallback(() => {
    bleManager.stopScan();
    if (mountedRef.current) setIsScanning(false);
  }, []);

  const startScanning = useCallback(async () => {
    try {
      const granted = await requestBlePermissions();
      if (!granted) {
        Alert.alert('Permission Required', 'Bluetooth permissions are required.');
        return;
      }
      const bluetoothOn = await isBluetoothPoweredOn();
      if (!bluetoothOn) {
        Alert.alert('Bluetooth Off', 'Please turn on Bluetooth first.');
        return;
      }
      bleManager.stopScan();
      setIsScanning(true);
      setDevices([]);

      bleManager.startScan(
        device => {
          const name = device.name ?? device.localName ?? null;
          if (!name || !name.toLowerCase().includes(TARGET_DEVICE_NAME.toLowerCase())) return;
          upsertDevice({
            id: device.id,
            name,
            localName: device.localName ?? null,
            address: device.id,
            rssi: device.rssi ?? null,
            lastSeen: Date.now(),
          });
        },
        error => {
          console.log('[Scanner] scan error =', error);
          if (mountedRef.current) setIsScanning(false);
          Alert.alert('Scan Error', String(error));
        },
        { allowDuplicates: true },
      );
    } catch (error) {
      console.log('[Scanner] startScanning error =', error);
      if (mountedRef.current) setIsScanning(false);
      Alert.alert('Error', String(error));
    } finally {
      if (mountedRef.current) setIsRefreshing(false);
    }
  }, [upsertDevice]);

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await startScanning();
  }, [startScanning]);

  const handleConnect = useCallback((item: BleDeviceItem) => {
    // ✅ Navigate immediately — ControllerScreen handles the connection
    bleManager.stopScan();
    setIsScanning(false);
    navigation.navigate('Controller', {
      deviceId: item.id,
      deviceName: item.name ?? item.localName ?? 'Unknown Device',
    });
  }, [navigation]);

  const handleExit = useCallback(() => {
    Alert.alert('Exit Application', 'Are you sure you want to close the application?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Exit', style: 'destructive', onPress: () => stopScanning() },
    ]);
  }, [stopScanning]);

  const handleOpenLocation = useCallback(async () => {
    try {
      const bluetoothOn = await isBluetoothPoweredOn();
      if (!bluetoothOn) {
        Alert.alert('Bluetooth Off', 'Please turn on Bluetooth first.');
        return;
      }
      Alert.alert(
        'Location Settings',
        'Please make sure Location is ON for BLE scanning.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Open Settings',
            onPress: async () => {
              try { await Linking.openSettings(); } catch { Alert.alert('Error', 'Unable to open settings.'); }
            },
          },
        ],
      );
    } catch {
      Alert.alert('Error', 'Unable to open location settings.');
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    void startScanning();
    return () => {
      mountedRef.current = false;
      bleManager.stopScan();
    };
  }, [startScanning]);

  const renderItem = ({ item }: { item: BleDeviceItem }) => {
    const connecting = connectingId === item.id;
    return (
      <TouchableOpacity
        style={styles.deviceCard}
        onPress={() => handleConnect(item)}
        disabled={connecting}
        activeOpacity={0.7}
      >
        {/* Bluetooth icon — like picture 2 */}
        <View style={styles.iconWrap}>
          <MaterialCommunityIcons name="bluetooth" size={26} color={BLUE} />
        </View>

        {/* Name + MAC */}
        <View style={styles.infoBlock}>
          <Text style={styles.deviceName} numberOfLines={1}>
            {item.name ?? 'Unknown Device'}
          </Text>
          <Text style={styles.deviceAddress} numberOfLines={1}>
            {item.address ?? item.id}
          </Text>
        </View>

        {/* RSSI + chevron */}
        <View style={styles.rightBlock}>
          <Text style={styles.rssiText}>{formatRssi(item.rssi)}</Text>
          {connecting
            ? <Text style={styles.connectingText}>...</Text>
            : <MaterialCommunityIcons name="chevron-right" size={22} color={TEXT_LIGHT} />
          }
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={WHITE} />

      {/* EBQ white top bar — no bluetooth icon */}
      <View style={styles.topBar}>
        <Text style={styles.topTitle}>BLE ChangeOver</Text>
        <View style={styles.topIcons}>
          {/* Refresh */}
          <TouchableOpacity onPress={() => void startScanning()} style={styles.iconBtn}>
            <MaterialCommunityIcons name="refresh" size={22} color={TEXT_DARK} />
          </TouchableOpacity>
          {/* Location */}
          <TouchableOpacity onPress={() => void handleOpenLocation()} style={styles.iconBtn}>
            <MaterialCommunityIcons name="map-marker-outline" size={22} color={TEXT_DARK} />
          </TouchableOpacity>
          {/* Power / Exit */}
          <TouchableOpacity onPress={handleExit} style={styles.iconBtn}>
            <MaterialCommunityIcons name="power" size={22} color={TEXT_DARK} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Device list */}
      <FlatList
        data={sortedDevices}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        contentContainerStyle={
          sortedDevices.length === 0 ? styles.emptyContainer : styles.listContent
        }
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => void onRefresh()}
            tintColor={BLUE}
          />
        }
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <MaterialCommunityIcons name="bluetooth-off" size={52} color={TEXT_LIGHT} />
            <Text style={styles.emptyText}>
              {isScanning ? `Scanning for ${TARGET_DEVICE_NAME}...` : 'No devices found'}
            </Text>
            <Text style={styles.emptySubText}>Pull down to refresh</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
  },

  // White top bar — EBQ style
  topBar: {
    height: 56,
    backgroundColor: WHITE,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: DIVIDER,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  topTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: TEXT_DARK,
    letterSpacing: 0.2,
  },
  topIcons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
  },

  // List
  listContent: {
    paddingVertical: 6,
  },
  separator: {
    height: 1,
    backgroundColor: DIVIDER,
    marginLeft: 76,
  },

  // Device card — white, full width
  deviceCard: {
    backgroundColor: WHITE,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 14,
  },

  // Round bluetooth icon — like picture 2
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: ICON_BG,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },

  infoBlock: {
    flex: 1,
    justifyContent: 'center',
  },
  deviceName: {
    fontSize: 15,
    fontWeight: '700',
    color: TEXT_DARK,
    marginBottom: 3,
  },
  deviceAddress: {
    fontSize: 12,
    color: TEXT_LIGHT,
    letterSpacing: 0.3,
  },

  rightBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
    gap: 4,
  },
  rssiText: {
    fontSize: 12,
    color: TEXT_LIGHT,
    marginRight: 2,
  },
  connectingText: {
    fontSize: 14,
    color: BLUE,
    fontWeight: '700',
  },

  // Empty state
  emptyContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: BG,
  },
  emptyWrap: {
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyText: {
    fontSize: 15,
    color: TEXT_LIGHT,
    textAlign: 'center',
    marginTop: 16,
    fontWeight: '500',
  },
  emptySubText: {
    fontSize: 13,
    color: TEXT_LIGHT,
    marginTop: 6,
    textAlign: 'center',
    opacity: 0.7,
  },
});