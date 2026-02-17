# SOARIS Mobile App

React Native (Expo Router) mobile app for SOARIS drone monitoring and control.

## Tech Stack
- Expo SDK 54
- React Native 0.81
- Expo Router
- Firebase Auth + Realtime Database
- `react-native-maps`

## Prerequisites
- Node.js 20+
- npm
- Android Studio emulator (or physical Android device)
- Firebase project

## 1. Install Dependencies
```bash
npm install
```

## 2. Configure Environment
Create `./.env.local` (copy from `./.env.example`):

```env
EXPO_PUBLIC_FIREBASE_API_KEY=
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=
EXPO_PUBLIC_FIREBASE_PROJECT_ID=
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
EXPO_PUBLIC_FIREBASE_APP_ID=
EXPO_PUBLIC_FIREBASE_DATABASE_URL=

EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=
EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=
```

Notes:
- Firebase keys are required for auth and realtime sensor data.
- Google keys are required only for Google login.
- iOS client ID is optional if you are not building/running iOS.

## 3. Firebase Console Setup
Enable these providers in **Authentication > Sign-in method**:
- Email/Password
- Google
- Anonymous (for Guest login)

If using Realtime Database data on Home:
- Create Realtime Database and set rules for your environment.
- Ensure paths exist for:
  - `temperature_data`
  - `Moisture_data`
  - `battery_level`

## 3.1 Firebase Free-Tier Quick Setup (Spark Plan)
Use this checklist if this is your first Firebase setup:

1. Go to [Firebase Console](https://console.firebase.google.com/) and create/select your project.
2. Open **Build > Authentication > Sign-in method** and enable:
   - Email/Password
   - Google
   - Anonymous
3. Open **Project settings > General > Your apps** and register:
   - Web app (needed for `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`)
   - Android app (needed for `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID`)
4. For Android OAuth:
   - Set package name to your app package (currently `com.autonomousuav.app` in `app.json`).
   - Use a valid SHA-1 from your debug/release keystore.
5. Open **Build > Realtime Database** and create a database (start in test mode for development only).
6. Add your Firebase config values to `.env.local`.
7. Restart Metro after env changes:
   ```bash
   npm run start
   ```

Tip:
- Spark (free plan) supports Authentication and Realtime Database with usage limits, which is enough for development/testing.

## 4. Run the App
```bash
npm run start
```

Shortcuts:
- Android: `npm run android`
- iOS: `npm run ios`
- Web: `npm run web`

## Lint / Type Check
```bash
npm run lint
npx tsc --noEmit
```

## App Flow
1. `login` / `signup`
2. `verify-email` (for non-anonymous users)
3. `pair-device`
4. Main tabs:
   - Home
   - Activity
   - Manual
   - Settings
5. Mapping area and Summary screens

## Current Implementation Status
- Auth: Firebase Auth is implemented (`Email/Password`, `Google`, `Guest/Anonymous`).
- Telemetry read: Home/Activity read live values from Firebase Realtime Database:
  - `temperature_data`
  - `Moisture_data`
  - `battery_level`
- Tab UX: Bottom tabs support both tap and horizontal swipe navigation.
- Manual guard (tap + swipe):
  - Manual tab is blocked unless flight mode is `Manual`.
  - If trying to enter `Manual` from `Activity` while not manual mode, app warns then redirects to `Settings`.
  - If trying to enter `Manual` from `Settings` while not manual mode, app warns then redirects to `Activity`.
- Theme: Core screens follow device light/dark mode.
- Pull-to-refresh is enabled on:
  - `Activity`
  - `Manual`
  - `Summary`
- Sticky table headers are enabled on:
  - `Manual`
  - `Summary`
- Responsive layout profile is applied for app screens and auth screens:
  - `small` (`<360`)
  - `medium` (`360-767`)
  - `large` (`>=768`)
  with compact spacing on small phones and centered max-width containers on tablets/large screens.
- Pair-device now supports explicit remove action:
  - Per-device trash icon with confirmation dialog
  - Long-press removal still supported

## Current Data Source Notes (Important)
- Pair-device and active-device selection are currently persisted locally on-device (`lib/pairing-session.ts`).
- Flight mode (`Auto`/`Manual`) is currently persisted locally on-device (`lib/flight-mode.tsx`).
- Plot data and selected plot are currently persisted locally on-device (`lib/plots-store.ts`).
- Mapping selection in `mapping-area` is currently local UI/state-driven.
- Activity timeline entries are currently static UI data.
- Summary recommendations/alerts are currently computed from local plot state.

These are functional for UI/dev testing, but should be replaced/integrated with your teammate backend services for production parity.

## Teammate Collaboration Quick Start
After cloning the repo, each teammate should:

1. Run `npm install`
2. Create their own `.env.local` (do not commit it)
3. Run `npm run lint` and `npx tsc --noEmit`
4. Start the app with `npm run android` (or `npm run start`)
