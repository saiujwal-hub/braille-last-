# Braille Bridge Android App

Flutter client for the Braille Bridge server (camera → text → speech).

## Setup

```bash
cd app
flutter pub get
flutter create . --org com.example   # materializes android/ ios/ platform folders
flutter run
```

Then open **Settings** and point the app at `http://<server-lan-ip>:8000`.

## Required platform permissions

Android (`android/app/src/main/AndroidManifest.xml`):

```xml
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
```

Also add `android:usesCleartextTraffic="true"` to `<application>` (LAN traffic is plain
HTTP, not HTTPS).

iOS (`ios/Runner/Info.plist`): add
`NSCameraUsageDescription`, `NSMicrophoneUsageDescription` and `NSAppTransportSecurity`
-> `NSAllowsLocalNetworking=true`.

## Architecture

| File | Responsibility |
| --- | --- |
| `lib/main.dart` | App entry, theme |
| `lib/config.dart` | Server URL (persisted), `ApiError` |
| `lib/models/scan_result.dart` | Mirrors `server/app/schemas.py` |
| `lib/services/api_client.dart` | `/scan`, `/health`, `/tts` |
| `lib/services/tts_service.dart` | Server WAV → on-device engine fallback |
| `lib/screens/home_screen.dart` | Camera + capture + debug toggle |
| `lib/screens/result_screen.dart` | Text, confidence, speak, uncertain markers |
| `lib/screens/debug_screen.dart` | Debug images + decoded cells grid |
| `lib/screens/settings_screen.dart` | LAN server host + connectivity check |

## Tests

```bash
flutter test
```
