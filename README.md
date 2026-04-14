# SOARIS Mobile App

React Native (Expo Router) mobile app for SOARIS ground-vehicle area monitoring, rover mission control, and irrigation recommendations.

## Tech Stack
- Expo SDK 54
- React Native 0.81
- Expo Router
- Firebase Auth + Realtime Database
- Supabase REST logging for recommendation history, mission logs, and activity alerts
- Expo Location for optional zone reference capture
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
- Supabase URL and publishable key are used for recommendation logging, rover mission records, and rover run history.
- The app can optionally use the phone's current GPS position as a reference marker on the Manage Zones screen, which requires location permission on the device.
- Firebase Realtime Database is also used as the live two-ESP32 rover coordination channel.

## 3. Firebase Console Setup
Enable these providers in **Authentication > Sign-in method**:
- Email/Password

If using Realtime Database data on Control:
- Create Realtime Database and set rules for your environment.
- Ensure paths exist for:
  - `robotControl`
  - `robotStatus`
  - `movementStatus`
  - `drillStatus`
  - `missionBus`
  - `telemetry/soilTempC`
  - `telemetry/airHumidity`
  - `telemetry/soilMoisturePct`
  - or `telemetry/soilMoistureRaw` if you want the app to convert raw readings into a percentage using the ESP32 calibration values
  - `devices/movement`
  - `devices/drill`

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
- Ensure rover mission and run rows are readable by the mobile app for mission history and summaries.

If using optional phone reference coordinates for zone setup:
- `navigation_targets` is legacy-only now and is no longer used by the current distance-based rover mission flow.
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
- Ensure Firebase Realtime Database allows:
  - the app to write only app-owned nodes:
    - `robotControl`
    - `missionBus`
  - the rover boards to write device-owned nodes:
    - `robotStatus`
    - `movementStatus`
    - `drillStatus`
    - `telemetry`
    - `devices/movement`
    - `devices/drill`
- The current app mission flow writes:
  - `robotControl.command`
  - `robotControl.missionId`
  - `robotControl.zoneCode`
  - `robotControl.requestedAt`
  - `robotControl.requestId`
  - `missionBus.stop_requested` while stopping
  - a clean `missionBus` baseline while starting

## Backend Architecture
The app now follows a two-ESP32 cloud coordination model:

- movement ESP32-CAM owns movement state
- drill ESP32 owns drill state and live sensor telemetry
- Firebase Realtime Database is the live coordination state machine
- Supabase is the persistent mission and rover-run history store

Use Firebase for live coordination:
- `robotControl`
  - app-owned command node
  - carries `command`, `missionId`, `zoneCode`, `requestedAt`, and `requestId`
- `robotStatus`
  - device-owned aggregate mission state
- `movementStatus`
  - movement-board live state
- `drillStatus`
  - drill-board live state
- `missionBus`
  - shared coordination state between movement and drill boards
- `telemetry`
  - live drill-side sensor values
- `devices/movement`
  - movement-board presence and metadata
- `devices/drill`
  - drill-board presence and metadata

Use Supabase for stored records and history:
- `rover_missions`
  - mission rows created by the app before a Firebase start command is sent
- `robot_runs`
  - latest terminal rover-run results per zone plus recommendation-related fields
- `mission_logs`
  - mission history and timeline records
- `activity_alerts`
  - rover warning and alert history

Rule of thumb:
- Firebase = live now
- Supabase = saved terminal history

Current app/backend split:
- Control page live widgets read Firebase:
  - `telemetry`
  - `robotStatus`
  - `movementStatus`
  - `drillStatus`
  - `missionBus`
  - `devices/*`
- Control saved zone cards read the latest terminal `robot_runs` row per zone from Supabase
- Summary uses saved Supabase-backed zone results and recommendation history
- Activity reads Supabase mission logs and activity alerts
- Start/Stop/Force Cancel only write app-owned control nodes plus Supabase mission fallbacks

Firebase nodes that should stay removed:
- `missionLogs`
- `activityAlerts`

## 3.1 Firebase Free-Tier Quick Setup (Spark Plan)
Use this checklist if this is your first Firebase setup:

1. Go to [Firebase Console](https://console.firebase.google.com/) and create/select your project.
2. Open **Build > Authentication > Sign-in method** and enable:
   - Email/Password
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
2. `verify-email`
3. Main tabs:
   - Home
   - Activity
   - Summary
   - Settings
4. Manage Zones screen for creating mission zones with optional reference coordinates
5. Activity screen:
   - recent mission logs and recent activity alerts show the latest 5 records by default
   - mission log history and activity alert history can be expanded separately
   - both feeds support clearing recent items and clearing older history from Supabase

## Current Implementation Status
- Auth: Firebase Auth is implemented with Email/Password.
- Telemetry read: Home reads live values from Firebase Realtime Database:
  - `telemetry/soilTempC`
  - `telemetry/airHumidity`
  - `telemetry/soilMoisturePct`
  - with fallback support for `telemetry/soilMoistureRaw` conversion
- Dashboard:
  - Control now focuses on `Zone Control` and `Saved Zones` instead of map-first monitoring.
  - Saved zone cards support active selection, circular moisture/temperature/humidity dials, and zone management actions.
  - Saved zone cards are backed by the latest completed or stopped Supabase rover run for each zone.
  - Live Readings, Selected Zone Status, Cloud Mission Control, and Irrigation Recommendation have an updated visual layout.
  - The recommendation panel calls the Railway ML API and now makes its source explicit:
    - live Firebase telemetry during an active mission
    - latest saved Supabase rover run when no live mission is active
- Manage Zones:
  - The old 4-point mapping flow was replaced with a saved-zone workflow.
  - Users create a zone name, optionally add notes, and can attach phone coordinates as a reference marker for that zone.
  - Phone coordinates are stored only as optional reference metadata for the zone and are not used as rover navigation targets.
  - Start Mission now creates a `rover_missions` row in Supabase, resets `missionBus`, then sends a live Firebase `robotControl` command with a fresh `requestId`.
  - Stop Mission now sends a live Firebase stop command and sets `missionBus.stop_requested = true`.
  - Force Cancel is a timeout-based escalation path and no longer directly overwrites device-owned Firebase live state.
  - The intended rover flow is: app creates a rover mission, app sends a Firebase start command, the movement and drill boards coordinate through `missionBus`, the rover gathers samples at the configured interval, and terminal mission/run state is saved into Supabase.
  - Saved zones can be added, edited, deleted, and marked active locally on-device.
- Activity screen now reads real mission logs and alerts from Supabase, newest first, with recent-feed and history sections.
- Tab UX: Bottom tabs support both tap and horizontal swipe navigation.
- Summary:
  - The previous Manual tab was replaced by a Summary monitoring screen.
  - Summary now complements Control by focusing on saved interpretation rather than live control actions.
  - Map Overview uses a list-style area summary instead of a fixed 2x2 grid.
  - Summary emphasizes selected-area recommendation details, priority queue, recommendation history, next-action guidance, and saved terminal rover-run context.
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
- The Manage Zones screen stores zone names locally with optional reference coordinates.
- The Manage Zones screen can also capture the phone's current location as an optional zone reference marker.
- Control live widgets now read direct Firebase state:
  - `telemetry`
  - `robotStatus`
  - `movementStatus`
  - `drillStatus`
  - `missionBus`
  - `devices/movement`
  - `devices/drill`
- Control saved zone cards no longer use historical averages; they use the latest terminal `robot_runs` row per zone from Supabase.
- Control mission controls only write app-owned cloud nodes:
  - `robotControl`
  - `missionBus`
- Activity timeline entries and alerts now read real Supabase mission/activity data, with session history separated from recent items.
- Summary stays Supabase-backed and does not duplicate live device-health cards from Firebase.
- Control and Summary area health indicators are still computed from saved plot/run state and local threshold rules.
- Irrigation recommendations are fetched from the deployed ML API and mirrored into local plot state, with optional Supabase logging.
- Supabase recommendation logging is wired in on Home, but requires valid env vars and an insert policy on `robot_runs`.
- The rover-side integration now targets:
  - Supabase `rover_missions` for distance-based mission jobs
  - Firebase `robotControl` for app-owned live mission start/stop commands
  - Firebase `robotStatus` for aggregate live mission state
  - Firebase `movementStatus` for movement-board state
  - Firebase `drillStatus` for drill-board state
  - Firebase `missionBus` for shared live coordination
  - Firebase `telemetry` for live rover sensor values
  - Firebase `devices/*` for board presence
  - Supabase `mission_logs` and `activity_alerts` for rover-side mission/event history
- The app includes a compatibility bridge so it can read both current firmware fields and the final two-board cloud schema during migration.
- Summary priority ranking is currently computed from local recommendation/state rules.

These are functional for UI/dev testing, but should be replaced/integrated with your teammate backend services for production parity.

## Teammate Collaboration Quick Start
After cloning the repo, each teammate should:

1. Run `npm install`
2. Create their own `.env.local` (do not commit it)
3. Run `npm run lint` and `npx tsc --noEmit`
4. Start the app with `npm run android` (or `npm run start`)


