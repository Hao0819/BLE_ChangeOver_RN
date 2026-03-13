# BLE ChangeOver

A React Native mobile application for monitoring and controlling a BLE (Bluetooth Low Energy) changeover device — **MyStarChangeOver**.

---

## Features

- Scan and discover nearby BLE devices
- Connect to `MyStarChangeOver` device
- Real-time monitoring of channel voltages, current, and output voltage
- View and update device settings
- Arabic language support
- Send Arabic text to device display

---

## Screens

### Scanner Screen
- Automatically scans for BLE devices on launch
- Displays device name, MAC address, and RSSI signal strength
- Tap a device to navigate immediately to Controller Screen
- Pull down to refresh scan

### Controller Screen
- Shows live telemetry: Channel 1/2/3 voltage, ON/OFF status
- Displays Current Reading, Output Voltage, Selected Channel, Over Current
- Raw BLE data hex display (data + settings packets)
- Arabic language toggle
- Three-dot menu (⋮) with: Refresh, Setting, Arabic, Disconnect, Exit Apps

---

## Requirements

- Node.js >= 18
- React Native >= 0.73
- Android 6.0+ / iOS 13+
- Physical device (BLE does not work on emulator)

### Dependencies

```
@react-navigation/native
@react-navigation/native-stack
react-native-ble-plx
react-native-vector-icons
```

---

## Installation

```bash
# 1. Clone the repository
git clone https://github.com/yourname/BLE_ChangeOver_RN.git
cd BLE_ChangeOver_RN

# 2. Install dependencies
npm install

# 3. Install iOS pods (iOS only)
cd ios && pod install && cd ..

# 4. Run on Android
npx react-native run-android

# 5. Run on iOS
npx react-native run-ios
```

---

## Permissions

### Android
Add to `AndroidManifest.xml`:
```xml
<uses-permission android:name="android.permission.BLUETOOTH" />
<uses-permission android:name="android.permission.BLUETOOTH_ADMIN" />
<uses-permission android:name="android.permission.BLUETOOTH_SCAN" />
<uses-permission android:name="android.permission.BLUETOOTH_CONNECT" />
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
```

### iOS
Add to `Info.plist`:
```xml
<key>NSBluetoothAlwaysUsageDescription</key>
<string>This app uses Bluetooth to connect to BLE devices.</string>
<key>NSLocationWhenInUseUsageDescription</key>
<string>Location is required for BLE scanning.</string>
```

---

## Project Structure

```
src/
├── ble/
│   ├── bleManager.ts       # BLE connection & scan logic
│   ├── commands.ts         # BLE command builders
│   └── parser.ts           # Incoming packet parser
├── navigation/
│   └── AppNavigator.tsx    # Stack navigator
├── screens/
│   ├── SplashScreen.tsx
│   ├── ScannerScreen.tsx
│   └── ControllerScreen.tsx
├── types/
│   ├── device.ts           # Device & telemetry types
│   └── navigation.ts       # Route param types
└── utils/
    └── permissions.ts      # BLE permission helpers
```

---

## BLE Protocol

| Packet Header | Type     | Description          |
|---------------|----------|----------------------|
| `0xAB`        | Data     | Telemetry packet     |
| `0xAD`        | Settings | Settings packet      |
| `0xAE, 0xC8`  | Command  | Request settings     |

---

## Device Settings

Configurable via the **Setting** menu:

| Parameter      | Description                        |
|----------------|------------------------------------|
| Switch Delay   | Delay before channel switching (s) |
| Cutoff Period  | Cutoff period duration (s)         |
| Threshold      | Threshold percentage (max 100)     |
| CH1/2/3 Max V  | Maximum voltage per channel (≤300V)|
| CH1/2/3 Min V  | Minimum voltage per channel (≥100V)|
| CH1/2/3 Max A  | Maximum current per channel (≤100A)|

---

## License

MIT
