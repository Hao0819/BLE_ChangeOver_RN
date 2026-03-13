import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  BackHandler,
  Modal,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types/navigation';
import { bleManager } from '../ble/bleManager';
import {
  buildArabicTextCommand,
  buildSettingCommand,
  buildSettingsCommandFromHumanValues,
} from '../ble/commands';
import { clearDeviceState, parseIncomingPacket } from '../ble/parser';
import {
  createEmptyDeviceState,
  type DeviceSettings,
  type DeviceState,
} from '../types/device';

type Props = NativeStackScreenProps<RootStackParamList, 'Controller'>;

// EBQ Color Palette — white topbar
const WHITE        = '#FFFFFF';
const BG           = '#F2F4F7';
const BLUE         = '#1565C0';
const CARD_BG      = '#FFFFFF';
const CARD_BORDER  = '#E2E6EC';
const VALUE_BORDER = '#97A2C0';
const VALUE_BG     = '#F0F2F7';
const TEXT_DARK    = '#1A1A2E';
const TEXT_MID     = '#5A6170';
const DIVIDER      = '#E8EAED';

function numberToInput(value: number): string {
  return String(value ?? 0);
}

function parseNumberInput(value: string): number {
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export default function ControllerScreen({ navigation, route }: Props) {
  // ✅ Fixed TS error: use ?. instead of || {}
  const deviceId   = route.params?.deviceId;
  const deviceName = route.params?.deviceName;

  const [isConnected, setIsConnected]           = useState(false);
  const [connectionText, setConnectionText]     = useState('Disconnected');
  const [arabicEnabled, setArabicEnabled]       = useState(false);
  const [showDropdown, setShowDropdown]         = useState(false);
  const [deviceState, setDeviceState]           = useState<DeviceState>(createEmptyDeviceState());
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showArabicModal, setShowArabicModal]     = useState(false);
  const [arabicText, setArabicText]               = useState('');
  const mountedRef = useRef(true);

  const [form, setForm] = useState({
    switchingDelay: '0', cutoffPeriod: '0', threshold: '0',
    ch1MaxVolts: '0', ch1MinVolts: '0', ch1MaxAmp: '0',
    ch2MaxVolts: '0', ch2MinVolts: '0', ch2MaxAmp: '0',
    ch3MaxVolts: '0', ch3MinVolts: '0', ch3MaxAmp: '0',
  });

  const labels = useMemo(() => {
    if (arabicEnabled) {
      return {
        channel1: 'القناة 1', channel2: 'القناة 2', channel3: 'القناة 3',
        currentReading: 'قراءة التيار', outputVoltage: 'جهد الخرج',
        selectedChannel: 'القناة المختارة', overCurrent: 'زيادة التيار',
      };
    }
    return {
      channel1: 'Channel 1', channel2: 'Channel 2', channel3: 'Channel 3',
      currentReading: 'Current Reading', outputVoltage: 'Output Voltage',
      selectedChannel: 'Selected Channel', overCurrent: 'Over Current',
    };
  }, [arabicEnabled]);

  const syncFormFromSettings = useCallback((settings: DeviceSettings) => {
    setForm({
      switchingDelay: numberToInput(settings.switchingDelay),
      cutoffPeriod:   numberToInput(settings.cutoffPeriod),
      threshold:      numberToInput(settings.threshold),
      ch1MaxVolts:    numberToInput(settings.ch1MaxVolts),
      ch1MinVolts:    numberToInput(settings.ch1MinVolts),
      ch1MaxAmp:      numberToInput(settings.ch1MaxAmp),
      ch2MaxVolts:    numberToInput(settings.ch2MaxVolts),
      ch2MinVolts:    numberToInput(settings.ch2MinVolts),
      ch2MaxAmp:      numberToInput(settings.ch2MaxAmp),
      ch3MaxVolts:    numberToInput(settings.ch3MaxVolts),
      ch3MinVolts:    numberToInput(settings.ch3MinVolts),
      ch3MaxAmp:      numberToInput(settings.ch3MaxAmp),
    });
  }, []);

  const requestLatestData = useCallback(async () => {
    try {
      const cmd = buildSettingCommand();
      await bleManager.writeBleDataWithoutResponse(cmd);
    } catch (error) {
      console.log('[Controller] requestLatestData error:', error);
    }
  }, []);

  const handleDisconnect = useCallback(async () => {
    try {
      await bleManager.disconnect();
    } catch (error) {
      console.log('[Controller] disconnect error:', error);
    } finally {
      if (mountedRef.current) {
        setIsConnected(false);
        setConnectionText('Disconnected');
        setDeviceState(clearDeviceState());
      }
      navigation.goBack();
    }
  }, [navigation]);

  useEffect(() => {
    const onBackPress = () => { void handleDisconnect(); return true; };
    const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => subscription.remove();
  }, [handleDisconnect]);

  const handleRefresh = useCallback(async () => {
    setShowDropdown(false);
    try {
      setDeviceState(clearDeviceState());
      await requestLatestData();
    } catch (error) {
      Alert.alert('Refresh Error', String(error));
    }
  }, [requestLatestData]);

  const openSettingsModal = useCallback(async () => {
    setShowDropdown(false);
    try { await requestLatestData(); } catch { /* ignore */ }
    syncFormFromSettings(deviceState.settings);
    setShowSettingsModal(true);
  }, [deviceState.settings, requestLatestData, syncFormFromSettings]);

  const openArabicModal = useCallback(() => {
    setShowDropdown(false);
    setShowArabicModal(true);
  }, []);

  // ✅ Disconnect only — stays on page, shows Disconnected status (like original app)
  const handleDisconnectFromMenu = useCallback(async () => {
    setShowDropdown(false);
    try {
      await bleManager.disconnect();
    } catch (error) {
      console.log('[Controller] disconnect error:', error);
    } finally {
      if (mountedRef.current) {
        setIsConnected(false);
        setConnectionText('Disconnected');
        setDeviceState(clearDeviceState());
      }
    }
  }, []);

  const handleExitApp = useCallback(() => {
    setShowDropdown(false);
    Alert.alert('Exit Application', 'Are you sure you want to exit?', [
      { text: 'No', style: 'cancel' },
      { text: 'Yes', style: 'destructive', onPress: () => void handleDisconnect() },
    ]);
  }, [handleDisconnect]);

  const handleSaveSettings = useCallback(async () => {
    const settings: DeviceSettings = {
      switchingDelay: parseNumberInput(form.switchingDelay),
      cutoffPeriod:   parseNumberInput(form.cutoffPeriod),
      threshold:      parseNumberInput(form.threshold),
      ch1MaxVolts:    parseNumberInput(form.ch1MaxVolts),
      ch1MinVolts:    parseNumberInput(form.ch1MinVolts),
      ch1MaxAmp:      parseNumberInput(form.ch1MaxAmp),
      ch2MaxVolts:    parseNumberInput(form.ch2MaxVolts),
      ch2MinVolts:    parseNumberInput(form.ch2MinVolts),
      ch2MaxAmp:      parseNumberInput(form.ch2MaxAmp),
      ch3MaxVolts:    parseNumberInput(form.ch3MaxVolts),
      ch3MinVolts:    parseNumberInput(form.ch3MinVolts),
      ch3MaxAmp:      parseNumberInput(form.ch3MaxAmp),
    };
    if (settings.ch1MaxVolts > 300 || settings.ch2MaxVolts > 300 || settings.ch3MaxVolts > 300) {
      Alert.alert('Invalid Input', 'Vmax is greater than 300V!'); return;
    }
    if (settings.ch1MinVolts < 100 || settings.ch2MinVolts < 100 || settings.ch3MinVolts < 100) {
      Alert.alert('Invalid Input', 'Vmin is lesser than 100V!'); return;
    }
    if (settings.ch1MaxAmp > 100 || settings.ch2MaxAmp > 100 || settings.ch3MaxAmp > 100) {
      Alert.alert('Invalid Input', 'Amax is greater than 100A!'); return;
    }
    if (settings.threshold > 100) {
      Alert.alert('Invalid Input', 'Threshold is greater than 100!'); return;
    }
    try {
      const payload = buildSettingsCommandFromHumanValues(settings);
      await bleManager.writeBleDataWithoutResponse(payload);
      setDeviceState(prev => ({ ...prev, settings }));
      setShowSettingsModal(false);
      Alert.alert('Success', 'Settings updated!');
    } catch (error) {
      Alert.alert('Error', String(error));
    }
  }, [form]);

  const handleSendArabic = useCallback(async () => {
    try {
      const payload = buildArabicTextCommand(arabicText);
      await bleManager.writeBleDataWithoutResponse(payload);
      setShowArabicModal(false);
      setArabicText('');
      Alert.alert('Success', 'Arabic text sent.');
    } catch (error) {
      Alert.alert('Error', String(error));
    }
  }, [arabicText]);

  useEffect(() => {
    mountedRef.current = true;
    navigation.setOptions({ headerShown: false });
    const setup = async () => {
      if (!deviceId) return;
      try {
        const alreadyConnected = await bleManager.isConnected(deviceId);
        if (!alreadyConnected) {
          if (mountedRef.current) setConnectionText('Connecting...');
          await bleManager.connect(deviceId);
        }
        if (!mountedRef.current) return;
        bleManager.monitorBleData(
          ({ bytes }) => { if (mountedRef.current) setDeviceState(prev => parseIncomingPacket(bytes, prev)); },
          error => { console.log('[Controller] monitorBleData error:', error); },
        );
        if (!mountedRef.current) return;
        setIsConnected(true);
        setConnectionText('Connected');
        await requestLatestData();
      } catch (error) {
        console.log('[Controller] init error:', error);
        if (mountedRef.current) { setIsConnected(false); setConnectionText('Disconnected'); }
      }
    };
    void setup();
    return () => { mountedRef.current = false; bleManager.stopMonitorBleData(); };
  }, [deviceId, navigation, requestLatestData]);

  const activeChannel = deviceState.telemetry.channel;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={WHITE} />

      {/* White top bar — EBQ style */}
      <View style={styles.topHeader}>
        <TouchableOpacity onPress={() => void handleDisconnect()} style={styles.headerSide}>
          <Text style={styles.headerBack}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{deviceName ?? 'Controller'}</Text>
        <TouchableOpacity onPress={() => setShowDropdown(prev => !prev)} style={styles.headerMenuBtn}>
          <Text style={styles.headerMenuDots}>⋮</Text>
        </TouchableOpacity>
      </View>

      {/* Dropdown menu */}
      {showDropdown && (
        <TouchableWithoutFeedback onPress={() => setShowDropdown(false)}>
          <View style={styles.dropdownOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.dropdownMenu}>
                <TouchableOpacity style={styles.dropdownItem} onPress={() => void handleRefresh()}>
                  <Text style={styles.dropdownText}>Refresh</Text>
                </TouchableOpacity>
                <View style={styles.dropdownDivider} />
                <TouchableOpacity style={styles.dropdownItem} onPress={() => void openSettingsModal()}>
                  <Text style={styles.dropdownText}>Setting</Text>
                </TouchableOpacity>
                <View style={styles.dropdownDivider} />
                <TouchableOpacity style={styles.dropdownItem} onPress={openArabicModal}>
                  <Text style={styles.dropdownText}>Arabic</Text>
                </TouchableOpacity>
                <View style={styles.dropdownDivider} />
                {/* ✅ Disconnect option */}
                <TouchableOpacity style={styles.dropdownItem} onPress={handleDisconnectFromMenu}>
                  <Text style={[styles.dropdownText, styles.dropdownTextRed]}>Disconnect</Text>
                </TouchableOpacity>
                <View style={styles.dropdownDivider} />
                <TouchableOpacity style={styles.dropdownItem} onPress={handleExitApp}>
                  <Text style={styles.dropdownText}>Exit Apps</Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      )}

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* Status row */}
        <View style={styles.nameRow}>
          <Text style={styles.smallName} numberOfLines={1}>
            {deviceName ?? 'Unknown'}{'  '}{deviceId ?? 'N/A'}
          </Text>
          <View style={styles.connectedWrap}>
            <View style={[styles.connectedDot, isConnected ? styles.connectedDotOn : styles.connectedDotOff]} />
            <Text style={styles.connectedText}>{connectionText}</Text>
          </View>
        </View>

        {/* Arabic + hex */}
        <View style={styles.block}>
          <View style={styles.arabicHeader}>
            <Text style={styles.blockTitle}>Arabic</Text>
            <Switch value={arabicEnabled} onValueChange={setArabicEnabled} thumbColor={arabicEnabled ? BLUE : '#ccc'} />
          </View>
          <View style={styles.hexRow}>
            <View style={styles.hexIconCircle}><Text style={styles.hexIconText}>i</Text></View>
            <Text style={styles.hexText}>{deviceState.rawDataHex}</Text>
          </View>
          <View style={styles.hexRow}>
            <View style={styles.hexIconCircle}><Text style={styles.hexIconText}>⚙</Text></View>
            <Text style={styles.hexText}>{deviceState.rawSettingHex}</Text>
          </View>
        </View>

        {/* Channels */}
        <View style={styles.block}>
          <ChannelRow title={labels.channel1} voltage={deviceState.telemetry.ch1Voltage.toFixed(1)} isOn={activeChannel === 1} />
          <ChannelRow title={labels.channel2} voltage={deviceState.telemetry.ch2Voltage.toFixed(1)} isOn={activeChannel === 2} />
          <ChannelRow title={labels.channel3} voltage={deviceState.telemetry.ch3Voltage.toFixed(1)} isOn={activeChannel === 3} />
        </View>

        {/* Info grid */}
        <View style={styles.infoGrid}>
          <InfoCard title={labels.currentReading}  value={deviceState.telemetry.current.toFixed(2)} unit="A" />
          <InfoCard title={labels.outputVoltage}   value={deviceState.telemetry.vout.toFixed(1)}    unit="V" />
          <InfoCard title={labels.selectedChannel} value={String(deviceState.telemetry.channel)} />
          <InfoCard title={labels.overCurrent}     value={String(deviceState.telemetry.overCurrent)} />
        </View>

      </ScrollView>

      {/* Settings Modal */}
      <Modal visible={showSettingsModal} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Settings</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              {([
                ['Switch Delay',  'switchingDelay'],
                ['Cutoff Period', 'cutoffPeriod'],
                ['Threshold',     'threshold'],
                ['CH1 Max V',     'ch1MaxVolts'],
                ['CH1 Min V',     'ch1MinVolts'],
                ['CH1 Max A',     'ch1MaxAmp'],
                ['CH2 Max V',     'ch2MaxVolts'],
                ['CH2 Min V',     'ch2MinVolts'],
                ['CH2 Max A',     'ch2MaxAmp'],
                ['CH3 Max V',     'ch3MaxVolts'],
                ['CH3 Min V',     'ch3MinVolts'],
                ['CH3 Max A',     'ch3MaxAmp'],
              ] as [string, keyof typeof form][]).map(([label, key]) => (
                <InputRow
                  key={key}
                  label={label}
                  value={form[key]}
                  onChangeText={v => setForm(p => ({ ...p, [key]: v }))}
                />
              ))}
            </ScrollView>
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.modalGrayBtn} onPress={() => setShowSettingsModal(false)}>
                <Text style={styles.modalGrayText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalBlueBtn} onPress={() => void handleSaveSettings()}>
                <Text style={styles.modalBlueText}>Update</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Arabic Modal */}
      <Modal visible={showArabicModal} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Arabic Text</Text>
            <TextInput value={arabicText} onChangeText={setArabicText} placeholder="Enter Arabic text" style={styles.textInput} />
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.modalGrayBtn} onPress={() => setShowArabicModal(false)}>
                <Text style={styles.modalGrayText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalBlueBtn} onPress={() => void handleSendArabic()}>
                <Text style={styles.modalBlueText}>Confirm</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function ChannelRow({ title, voltage, isOn }: { title: string; voltage: string; isOn: boolean }) {
  return (
    <View style={styles.channelRow}>
      <Text style={styles.channelTitle}>{title}</Text>
      <View style={styles.channelControls}>
        <View style={styles.valueBox}><Text style={styles.valueText}>{voltage}</Text></View>
        <Text style={styles.unitText}>V</Text>
        <View style={[styles.statusBadge, isOn ? styles.statusOn : styles.statusOff]}>
          <Text style={styles.statusBadgeText}>{isOn ? 'ON' : 'OFF'}</Text>
        </View>
      </View>
    </View>
  );
}

function InfoCard({ title, value, unit }: { title: string; value: string; unit?: string }) {
  return (
    <View style={styles.infoCard}>
      <Text style={styles.infoTitle}>{title}</Text>
      <View style={styles.infoValueRow}>
        <View style={styles.infoValueBox}><Text style={styles.infoValueText}>{value}</Text></View>
        {unit ? <Text style={styles.infoUnit}>{unit}</Text> : null}
      </View>
    </View>
  );
}

function InputRow({ label, value, onChangeText }: { label: string; value: string; onChangeText: (v: string) => void }) {
  return (
    <View style={styles.inputRow}>
      <Text style={styles.inputLabel}>{label}</Text>
      <TextInput value={value} onChangeText={onChangeText} keyboardType="numeric" style={styles.textInput} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },

  // White top bar — EBQ style
  topHeader: {
    height: 56,
    backgroundColor: WHITE,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: DIVIDER,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  headerSide: { width: 44, justifyContent: 'center' },
  headerBack: { color: BLUE, fontSize: 24, fontWeight: '700' },
  headerTitle: { flex: 1, color: TEXT_DARK, fontSize: 18, fontWeight: '700', marginLeft: 8 },
  headerMenuBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerMenuDots: { color: TEXT_DARK, fontSize: 26, fontWeight: '700', lineHeight: 28 },

  // Dropdown
  dropdownOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 100 },
  dropdownMenu: {
    position: 'absolute', top: 56, right: 8, backgroundColor: WHITE,
    borderRadius: 6, elevation: 8, shadowColor: '#000', shadowOpacity: 0.15,
    shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, minWidth: 160, zIndex: 101,
  },
  dropdownItem: { paddingVertical: 14, paddingHorizontal: 20 },
  dropdownText: { fontSize: 15, color: '#222' },
  dropdownTextRed: { color: '#EF4444' },   // ✅ Red for Disconnect
  dropdownDivider: { height: 1, backgroundColor: '#EEE' },

  // Content
  content: { padding: 12, paddingBottom: 28 },
  nameRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  smallName: { fontSize: 12, color: '#6B7280', flex: 1, marginRight: 8 },
  connectedWrap: { flexDirection: 'row', alignItems: 'center' },
  connectedDot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  connectedDotOn: { backgroundColor: '#22C55E' },
  connectedDotOff: { backgroundColor: '#9CA3AF' },
  connectedText: { fontSize: 12, color: '#6B7280' },

  // Blocks
  block: { backgroundColor: CARD_BG, borderRadius: 8, borderWidth: 1, borderColor: CARD_BORDER, padding: 12, marginBottom: 10 },
  blockTitle: { fontSize: 14, color: TEXT_DARK, fontWeight: '600' },
  arabicHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  hexRow: { flexDirection: 'row', alignItems: 'flex-start', marginTop: 8 },
  hexIconCircle: { width: 20, height: 20, borderRadius: 10, backgroundColor: BLUE, alignItems: 'center', justifyContent: 'center', marginRight: 6, marginTop: 1 },
  hexIconText: { color: WHITE, fontSize: 11, fontWeight: '700' },
  hexText: { flex: 1, fontSize: 11, color: '#9CA3AF', lineHeight: 16 },

  // Channels
  channelRow: { alignItems: 'center', marginBottom: 14 },
  channelTitle: { fontSize: 12, fontWeight: '700', color: TEXT_MID, marginBottom: 6 },
  channelControls: { flexDirection: 'row', alignItems: 'center' },
  valueBox: { minWidth: 92, height: 44, borderRadius: 6, borderWidth: 1, borderColor: VALUE_BORDER, backgroundColor: VALUE_BG, alignItems: 'center', justifyContent: 'center' },
  valueText: { fontSize: 18, color: TEXT_DARK, fontWeight: '500' },
  unitText: { marginHorizontal: 10, fontSize: 22, color: '#6B7280' },
  statusBadge: { minWidth: 54, height: 44, borderRadius: 4, alignItems: 'center', justifyContent: 'center', marginLeft: 6 },
  statusOn: { backgroundColor: '#22C55E' },
  statusOff: { backgroundColor: '#EF4444' },
  statusBadgeText: { color: WHITE, fontWeight: '700', fontSize: 14 },

  // Info grid
  infoGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  infoCard: { width: '49%', backgroundColor: CARD_BG, borderRadius: 8, borderWidth: 1, borderColor: CARD_BORDER, paddingVertical: 12, paddingHorizontal: 10, marginBottom: 10, alignItems: 'center' },
  infoTitle: { fontSize: 12, color: TEXT_MID, marginBottom: 8, textAlign: 'center' },
  infoValueRow: { flexDirection: 'row', alignItems: 'center' },
  infoValueBox: { minWidth: 74, height: 38, borderRadius: 6, borderWidth: 1, borderColor: VALUE_BORDER, backgroundColor: VALUE_BG, alignItems: 'center', justifyContent: 'center' },
  infoValueText: { fontSize: 16, color: TEXT_DARK, fontWeight: '500' },
  infoUnit: { marginLeft: 8, fontSize: 20, color: '#6B7280' },

  // Modal
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 18 },
  modalCard: { backgroundColor: WHITE, borderRadius: 16, padding: 16, maxHeight: '85%' },
  modalTitle: { fontSize: 20, fontWeight: '700', color: TEXT_DARK, marginBottom: 12 },
  inputRow: { marginBottom: 12 },
  inputLabel: { fontSize: 14, color: '#374151', marginBottom: 6, fontWeight: '600' },
  textInput: { borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: '#111827', backgroundColor: WHITE },
  modalButtons: { flexDirection: 'row', gap: 10, marginTop: 14 },
  modalGrayBtn: { flex: 1, backgroundColor: '#E5E7EB', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  modalGrayText: { color: '#374151', fontSize: 15, fontWeight: '700' },
  modalBlueBtn: { flex: 1, backgroundColor: BLUE, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  modalBlueText: { color: WHITE, fontSize: 15, fontWeight: '700' },
});