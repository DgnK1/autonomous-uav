# SOARIS Mobile App

React Native (Expo Router) mobile app for SOARIS ground-vehicle area monitoring, rover mission control, and irrigation recommendations.

## Tech Stack
- Expo SDK 54
- React Native 0.81
- Expo Router
- Firebase Auth + Realtime Database
- Supabase REST logging for recommendation history, mission logs, and activity alerts
- Expo Location for phone GPS capture
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
- Supabase URL and publishable key are used for recommendation logging and for fetching the latest sensor-transmitted latitude/longitude on the Set Location screen.
- The app can also use the phone's current GPS position on the Set Location screen, which requires location permission on the device.
- Firebase Realtime Database is also used as the live rover command and status channel through `robotControl` and `robotStatus`.

## 3. Firebase Console Setup
Enable these providers in **Authentication > Sign-in method**:
- Email/Password
- Google
- Anonymous (for Guest login)

If using Realtime Database data on Home:
- Create Realtime Database and set rules for your environment.
- Ensure paths exist for:
  - `telemetry/soilTempC`
  - `telemetry/airHumidity`
  - `telemetry/soilMoisturePct`
  - or `telemetry/soilMoistureRaw` if you want the app to convert raw readings into a percentage using the ESP32 calibration values

If using Supabase recommendation logging:
- Create the `robot_runs` table used by your team backend.
- Ensure these columns exist:
  - `latitude`
  - `longitude`
  - or compatible coordinate aliases such as `lat` / `lng`
  - `recommendation`
  - `recommendation_confidence`
  - `recommendation_explanation`
- Add an insert policy for client logging if you want the mobile app to write directly.
- Ensure the latest sensor-uploaded row is readable by the mobile app so Set Location can fetch the newest coordinates from Supabase.

If using phone GPS as a navigation target source:
- Create a `navigation_targets` table for pending destinations sent by the app.
- Recommended starter SQL:
  ```sql
  create table if not exists public.navigation_targets (
    id bigint generated always as identity primary key,
    zone_code text,
    latitude double precision not null,
    longitude double precision not null,
    source text not null default 'phone',
    status text not null default 'pending',
    created_at timestamptz not null default now()
  );

  alter table public.navigation_targets enable row level security;

  create policy "allow anon insert navigation_targets"
  on public.navigation_targets
  for insert
  to anon
  with check (true);

  create policy "allow anon select navigation_targets"
  on public.navigation_targets
  for select
  to anon
  using (true);
  ```

If using Supabase mission and alert logging from the rover:
- Create `mission_logs` and `activity_alerts` with anon insert/select policies.
- Recommended starter SQL:
  ```sql
  create table if not exists public.mission_logs (
    id bigint generated always as identity primary key,
    device_id text,
    type text not null default 'info',
    message text not null,
    zone_index integer,
    pass_count integer,
    latitude double precision,
    longitude double precision,
    target_id bigint,
    target_lat double precision,
    target_lng double precision,
    created_at timestamptz not null default now()
  );

  create table if not exists public.activity_alerts (
    id bigint generated always as identity primary key,
    device_id text,
    severity text not null default 'warning',
    message text not null,
    zone_index integer,
    pass_count integer,
    latitude double precision,
    longitude double precision,
    created_at timestamptz not null default now()
  );

  alter table public.mission_logs enable row level security;
  alter table public.activity_alerts enable row level security;

  create policy "allow anon insert mission_logs"
  on public.mission_logs
  for insert
  to anon
  with check (true);

  create policy "allow anon select mission_logs"
  on public.mission_logs
  for select
  to anon
  using (true);

  create policy "allow anon insert activity_alerts"
  on public.activity_alerts
  for insert
  to anon
  with check (true);

  create policy "allow anon select activity_alerts"
  on public.activity_alerts
  for select
  to anon
  using (true);
  ```

If using app-driven rover missions:
- Ensure Firebase Realtime Database allows the app and rover to read/write:
  - `robotControl`
  - `robotStatus`
  - `telemetry`
  - `missionLogs`
  - `activityAlerts`
- The current app Start/Stop Mission flow writes `robotControl` with:
  - `command`
  - `targetId`
  - `requestedAt`

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
4. Manage Saved Zones screen for setting and selecting saved locations

## Current Implementation Status
- Auth: Firebase Auth is implemented (`Email/Password`, `Google`, `Guest/Anonymous`).
- Telemetry read: Home reads live values from Firebase Realtime Database:
  - `telemetry/soilTempC`
  - `telemetry/airHumidity`
  - `telemetry/soilMoisturePct`
  - with fallback support for `telemetry/soilMoistureRaw` conversion
- Dashboard:
  - Home now focuses on `Area Control` and `Active Areas` instead of map-first monitoring.
  - Area cards support active selection, circular moisture/temperature/humidity dials, and location management actions.
  - Live Readings, Selected Area Status, Mission Controls, and Irrigation Recommendation have an updated visual layout.
  - The recommendation panel calls the Railway ML API and stores the result locally for Summary.
- Set Location / Manage Saved Zones:
  - The old 4-point mapping flow was replaced with a saved-zone workflow.
  - Users open the Set Sensor Location card, either fetch the latest latitude/longitude transmitted by the sensor to Supabase or use the phone's current GPS location, then save that position as a zone.
  - Using the phone location also sends the captured latitude/longitude to Supabase as a pending row in `navigation_targets`.
  - Start Mission now uses the currently selected saved zone, creates a new `navigation_targets` row in Supabase, then sends a live Firebase `robotControl` command for the rover to begin that exact target.
  - Stop Mission now sends a live Firebase stop command and the app best-effort marks the current target as `cancelled`.
  - The intended robot flow is: app inserts a target, app sends a Firebase start command, robot claims that exact `targetId`, navigates there, gathers data, and updates the target status.
  - Saved zones can be added, edited, deleted, and marked active locally on-device.
- Activity screen now reads real mission logs and alerts from Firebase, newest first, with empty-state guidance when no live rover data exists yet.
- Tab UX: Bottom tabs support both tap and horizontal swipe navigation.
- Summary:
  - The previous Manual tab was replaced by a Summary monitoring screen.
  - Summary now complements Control by focusing on interpretation rather than live control actions.
  - Map Overview uses a list-style area summary instead of a fixed 2x2 grid.
  - Summary emphasizes selected-area recommendation details, priority queue, recommendation history, and next-action guidance.
  - Recommendation History now shows only saved recommendation entries and falls back to an empty-state message when no history exists yet.
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
- Saved zones and selected zone are currently persisted locally on-device (`lib/plots-store.ts`).
- The Set Location screen fetches the newest transmitted coordinates from Supabase before saving a zone locally.
- The Set Location screen can also capture the phone's current location and post those coordinates to `navigation_targets` in Supabase.
- Home now reads direct live telemetry from Firebase instead of using saved-zone placeholder values for the live cards and recommendation request.
- Home mission controls now read live rover state from Firebase `robotStatus` and write commands to Firebase `robotControl`.
- Activity timeline entries and alerts now read real Firebase mission/activity data, with sample entries filtered out.
- Home and Summary area health indicators are currently computed from local plot state and local threshold rules.
- Irrigation recommendations are fetched from the deployed ML API and mirrored into local plot state.
- Supabase recommendation logging is wired in on Home, but requires valid env vars and an insert policy on `robot_runs`.
- The rover-side integration now targets:
  - Supabase `navigation_targets` for mission destinations
  - Firebase `robotControl` for live mission start/stop commands
  - Firebase `robotStatus` for live rover state
  - Supabase `mission_logs` and `activity_alerts` for rover-side mission/event history
- The current rover mission routine is intended to:
  - navigate to the selected target
  - perform 3 sampling passes
  - lower the probe, wait 5 seconds, capture soil readings, raise the probe
  - move forward about 2 seconds between passes
  - mark the mission complete after the 3rd pass
- Summary priority ranking is currently computed from local recommendation/state rules.

These are functional for UI/dev testing, but should be replaced/integrated with your teammate backend services for production parity.

## Teammate Collaboration Quick Start
After cloning the repo, each teammate should:

1. Run `npm install`
2. Create their own `.env.local` (do not commit it)
3. Run `npm run lint` and `npx tsc --noEmit`
4. Start the app with `npm run android` (or `npm run start`)
