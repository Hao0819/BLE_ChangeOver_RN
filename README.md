# BLE ChangeOver

A React Native mobile application for monitoring and controlling the **MyStarChangeOver** automatic transfer switch (ATS) device via Bluetooth Low Energy (BLE).

---

## Overview

BLE ChangeOver allows engineers and technicians to wirelessly connect to the MyStarChangeOver hardware device and:

- Monitor real-time voltage and current across three power channels
- Configure protection thresholds and switching parameters
- Send Arabic text to the device's display
- View live telemetry and device status

---

## Features

- 🔵 **BLE Device Scanner** — Scans and lists nearby `MyStarChangeOver` devices
- ⚡ **Real-time Telemetry** — Live voltage (CH1/CH2/CH3), output current, and active channel display
- ⚙️ **Settings Control** — Configure switching delay, cutoff period, voltage limits, and current limits per channel
- 🌐 **Arabic Language Support** — Toggle Arabic UI labels and send Arabic text to the device LCD
- 🔒 **Input Validation** — Guards against out-of-range values (e.g. Vmax > 300V, Vmin < 100V, Amax > 100A)
- 📡 **Raw Data Inspector** — View raw BLE data and settings packets in hex format

---

## Tech Stack

| Library | Purpose |
|---|---|
| React Native | Cross-platform mobile framework (iOS & Android) |
| React Navigation (Native Stack) | Screen navigation |
| react-native-ble-plx | Bluetooth Low Energy communication |
| react-native-vector-icons | UI icons (MaterialCommunityIcons) |
| Custom BLE Protocol | Binary command building and packet parsing |

---

## Project Structure

```
src/
├── ble/
│   ├── bleManager.ts        # BLE connection, scan, read/write logic
│   ├── commands.ts          # Binary command builders (settings, Arabic text)
│   └── parser.ts            # Incoming BLE packet parser
├── screens/
│   ├── ScannerScreen.tsx    # BLE device discovery screen
│   └── ControllerScreen.tsx # Device monitoring and control screen
├── types/
│   ├── device.ts            # DeviceState, DeviceSettings, BleDeviceItem types
│   └── navigation.ts        # RootStackParamList navigation types
└── utils/
    └── permissions.ts       # BLE & location permission helpers
```

---

## Getting Started

### Prerequisites

- Node.js >= 18
- React Native CLI environment set up ([guide](https://reactnative.dev/docs/environment-setup))
- Android Studio (for Android) or Xcode (for iOS)
- Physical device with Bluetooth (BLE scanning does not work on emulators)

### Installation

```bash
# Clone the repository
git clone https://github.com/your-org/ble-changeover.git
cd ble-changeover

# Install dependencies
npm install

# iOS only — install pods
cd ios && pod install && cd ..
```

### Running the App

```bash
# Android
npm run android

# iOS
npm run ios
```

---

## Permissions

### Android

The following permissions are required in `AndroidManifest.xml`:

```xml
<uses-permission android:name="android.permission.BLUETOOTH_SCAN" />
<uses-permission android:name="android.permission.BLUETOOTH_CONNECT" />
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
```

### iOS

Add the following keys to `Info.plist`:

```xml
<key>NSBluetoothAlwaysUsageDescription</key>
<string>This app uses Bluetooth to connect to the ChangeOver device.</string>
<key>NSLocationWhenInUseUsageDescription</key>
<string>Location access is required for BLE scanning.</string>
```

---

## Device Settings Reference

| Parameter | Valid Range | Description |
|---|---|---|
| Switch Delay | — | Delay before switching channels (ms) |
| Cutoff Period | — | Duration before cutoff is triggered |
| Threshold | 0 – 100 | Sensitivity threshold |
| CH1/CH2/CH3 Max Volts | ≤ 300 V | Upper voltage limit per channel |
| CH1/CH2/CH3 Min Volts | ≥ 100 V | Lower voltage limit per channel |
| CH1/CH2/CH3 Max Amps | ≤ 100 A | Maximum current per channel |

---

## Target Device

**Device Name:** `MyStarChangeOver`

The app scans for BLE devices whose name matches `MyStarChangeOver`. Ensure your hardware is powered on and advertising before scanning.

---

## License

This project is proprietary. All rights reserved.

---

## Contact

For support or inquiries, please contact the development team.
