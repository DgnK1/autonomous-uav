# SOARIS Mobile App

React Native (Expo Router) mobile app for SOARIS ground-vehicle area monitoring and irrigation recommendations.

## Tech Stack
- Expo SDK 54
- React Native 0.81
- Expo Router
- Firebase Auth + Realtime Database
- Supabase REST logging for recommendation history
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
EXPO_PUBLIC_IRRIGATION_API_URL=
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
```

Notes:
- Firebase keys are required for auth and realtime sensor data.
- Google keys are required only for Google login.
- iOS client ID is optional if you are not building/running iOS.
- `EXPO_PUBLIC_IRRIGATION_API_URL` points to the deployed Railway ML API.
- Supabase URL and publishable key are optional until recommendation logging is enabled in your environment.

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

If using Supabase recommendation logging:
- Create the `robot_runs` table used by your team backend.
- Ensure these columns exist:
  - `recommendation`
  - `recommendation_confidence`
  - `recommendation_explanation`
- Add an insert policy for client logging if you want the mobile app to write directly.

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
3. Main tabs:
   - Home
   - Activity
   - Summary
   - Settings
4. Mapping area screen for setting monitored areas

## Current Implementation Status
- Auth: Firebase Auth is implemented (`Email/Password`, `Google`, `Guest/Anonymous`).
- Telemetry read: Home reads live values from Firebase Realtime Database:
  - `temperature_data`
  - `Moisture_data`
  - `battery_level`
- Dashboard:
  - Home now focuses on `Area Control` and `Active Areas` instead of map-first monitoring.
  - Area cards support active selection, circular moisture/temperature/humidity dials, and location management actions.
  - Live Readings, Selected Area Status, and Irrigation Recommendation have an updated visual layout.
  - The recommendation panel calls the Railway ML API and stores the result locally for Summary.
- Activity screen shows mission progress, logged events, a UGV-style task timeline, and alerts without a camera/live-feed panel.
- Tab UX: Bottom tabs support both tap and horizontal swipe navigation.
- Summary:
  - The previous Manual tab was replaced by a Summary monitoring screen.
  - Summary now complements Control by focusing on interpretation rather than live control actions.
  - Map Overview uses a list-style area summary instead of a fixed 2x2 grid.
  - Summary emphasizes selected-area recommendation details, priority queue, recommendation history, and next-action guidance.
- Onboarding:
  - New users now see a first-launch onboarding flow before login.
  - The Summary tab now uses the dedicated `summary` route name instead of the old `manual` file path.
- Theme: Core screens follow device light/dark mode.
- Pull-to-refresh is enabled on:
  - `Activity`
  - `Summary`
- Android sticky-header mode for these tables was removed to avoid known `ScrollView` header rendering glitches.
- Tab/button label sizing was tightened to reduce truncation on small screens and with accessibility text scaling.
- Responsive layout profile is applied for app screens and auth screens:
  - `small` (`<360`)
  - `medium` (`360-767`)
  - `large` (`>=768`)
  with compact spacing on small phones and centered max-width containers on tablets/large screens.
## Current Data Source Notes (Important)
- Plot data and selected plot are currently persisted locally on-device (`lib/plots-store.ts`).
- Mapping selection in `mapping-area` is currently local UI/state-driven.
- Activity timeline entries and alerts are currently static UI data.
- Home and Summary area health indicators are currently computed from local plot state and local threshold rules.
- Irrigation recommendations are fetched from the deployed ML API and mirrored into local plot state.
- Supabase recommendation logging is wired in on Home, but requires valid env vars and an insert policy on `robot_runs`.
- Summary priority ranking is currently computed from local recommendation/state rules.

These are functional for UI/dev testing, but should be replaced/integrated with your teammate backend services for production parity.

## Teammate Collaboration Quick Start
After cloning the repo, each teammate should:

1. Run `npm install`
2. Create their own `.env.local` (do not commit it)
3. Run `npm run lint` and `npx tsc --noEmit`
4. Start the app with `npm run android` (or `npm run start`)
