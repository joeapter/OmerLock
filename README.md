# OmerLock

Production-ready Expo React Native app for persistent nightly Sefiras HaOmer reminders with forced user interaction.

## Features

- Hebrew-calendar-driven Omer engine (1-49).
- Automatic in-season detection.
- Nightfall (`tzeit hakochavim`) via Hebcal API with location.
- Fallback fixed-time tzeit when location/API is unavailable.
- High-priority persistent reminder notifications.
- Escalation system (frequency + urgency + vibration channel).
- Full nusach in reminders and in-app modal:
  - Brachah (conditional)
  - Hebrew + English count text
  - Harachaman
- Halachic state:
  - Missed full-day detection
  - Automatic brachah disable after miss
  - Override controls
- Forced-interaction modal with friction challenge:
  - Hold 2 seconds
  - Enter correct day number
  - Choose correct option from 3 choices
- Offline-first persistence with AsyncStorage.
- Optional Supabase sync queue.
- Hardcore mode lock:
  - App locks to modal until completion
  - Persistent banner + navigation lock
- Dark default UI with Hebrew-first typography.

## Stack

- Expo + React Native + TypeScript
- `expo-notifications`
- `expo-location`
- `@react-native-async-storage/async-storage`
- Optional: Supabase (`@supabase/supabase-js`)

## Setup

1. Install Node.js 20+.
2. Install dependencies:

```bash
npm install
```

3. Optional Supabase:
   - Copy `.env.example` to `.env`.
   - Fill in `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`.
   - Apply `supabase/schema.sql`.

4. Start Expo:

```bash
npm run start
```

5. Run on device/emulator:

```bash
npm run android
npm run ios
```

## EAS TestFlight

1. Install/update deps (includes `eas-cli`):

```bash
npm install
```

2. Log in and link the Expo project (first time only):

```bash
npx eas login
npx eas init
```

3. Build and auto-submit to TestFlight:

```bash
npm run eas:deploy:testflight
```

This uses:
- `eas.json` production profile
- iOS `buildNumber` auto-increment
- automatic submit to App Store Connect after build

## Project Structure

```text
.
├── App.tsx
├── app.json
├── index.ts
├── src
│   ├── components
│   │   ├── ConfirmationChallenge.tsx
│   │   ├── ForcedOmerModal.tsx
│   │   └── OmerBanner.tsx
│   ├── constants
│   │   ├── defaults.ts
│   │   ├── nusach.ts
│   │   └── theme.ts
│   ├── screens
│   │   ├── HistoryScreen.tsx
│   │   ├── HomeScreen.tsx
│   │   └── SettingsScreen.tsx
│   ├── services
│   │   ├── hebcalService.ts
│   │   ├── locationService.ts
│   │   ├── notificationService.ts
│   │   ├── omerEngine.ts
│   │   ├── storageService.ts
│   │   └── syncService.ts
│   ├── state
│   │   └── OmerLockContext.tsx
│   ├── types
│   │   └── index.ts
│   └── utils
│       ├── challenge.ts
│       ├── date.ts
│       └── omerText.ts
└── supabase
    └── schema.sql
```
