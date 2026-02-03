# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

傘判断アプリ (Umbrella Decision App) - A React Native/Expo app that tells users whether they need an umbrella based on weather forecasts from Japan Meteorological Agency (JMA) API. UI is entirely in Japanese.

## Development Commands

```bash
npm run start      # Start Expo dev server
npm run ios        # Run on iOS simulator
npm run android    # Run on Android emulator
npm run web        # Run in web browser
```

No test framework or linting is configured. TypeScript strict mode is enabled (extends `expo/tsconfig.base`).

## Architecture

### Navigation Stack ([App.tsx](App.tsx))

React Navigation native-stack with 4 screens:
- `Home` (headerShown: false) — main umbrella decision display
- `Settings` — all app settings
- `Terms` / `Disclaimer` / `License` — legal screens under [src/screens/legal/](src/screens/legal/)

Theme-aware navigation (light/dark) based on system color scheme. Notification listeners are registered at root level.

### Services Layer ([src/services/](src/services/))

| Service | Responsibility |
|---------|---------------|
| **weatherApi.ts** | JMA API fetch, umbrella decision logic, hourly forecast extraction, temperature extraction |
| **locationService.ts** | GPS permission, coordinates acquisition, reverse geocode → prefecture → JMA area code |
| **nominatimService.ts** | OpenStreetMap Nominatim address search (Japan-only), deduplication, prefecture extraction |
| **notificationService.ts** | expo-notifications: two modes (`fixed` time daily, `beforeOuting` per-day schedule), umbrella decision in notification body |
| **storageService.ts** | AsyncStorage wrapper: settings CRUD, weekly schedule, 15-min weather cache, settings migration |

### Data Flow

1. GPS coordinates → reverse geocode → prefecture name → JMA area code (via `PREFECTURE_NAME_TO_CODE` map in [src/constants/areaCodes.ts](src/constants/areaCodes.ts))
2. Area code → JMA API → weather forecast → umbrella decision
3. Origin + destination comparison for commute scenarios (combined decision uses worst-case)

### Umbrella Decision Logic ([src/services/weatherApi.ts](src/services/weatherApi.ts))

- Thresholds are user-configurable (`popThreshold`, `precipitationThreshold`, AND/OR logic)
- Defaults: ≥50% rain probability = `required`, ≥30% = `recommended`, otherwise `not_required`
- `determineCombinedUmbrella()` merges origin/destination results, taking the worse decision

### Weekly Schedule System

Settings use a per-day schedule (`WeeklySchedule` in [src/types/index.ts](src/types/index.ts)):
- Each day (0=Sunday–6=Saturday) has: `enabled`, `originLocationId`, `destinationLocationId`, `outingStart`, `outingEnd`
- `originLocationId: null` means "use GPS", otherwise references a saved `Location.id`
- HomeScreen auto-switches to tomorrow's forecast when current time passes today's `outingEnd`

### Components ([src/components/](src/components/))

- **TimePickerModal.tsx** — Wheel-style hour/minute picker with scroll-to-select
- **LocationSearchModal.tsx** — Address search via Nominatim with 400ms debounce, prefecture badge display

### Theme System ([src/theme/index.ts](src/theme/index.ts))

`ThemeProvider` context with `useTheme()` hook. Light/dark themes with umbrella-specific colors:
- `umbrellaRequired` (red), `umbrellaRecommended` (orange), `umbrellaNotRequired` (green)
- Tablet detection: width ≥ 768px triggers 1.5x responsive scaling

### Key Types ([src/types/index.ts](src/types/index.ts))

- `UmbrellaDecision`: `'required' | 'recommended' | 'not_required'`
- `AppErrorType`: `'offline' | 'api' | 'permission' | 'manual_location' | 'unknown'`
- `NotificationMode`: `'fixed' | 'beforeOuting'`
- `Settings`: Notification prefs, umbrella criteria, weekly schedule, locations, display prefs
- Type guards: `isAppError()`, `isJmaForecastResponse()`

## External APIs

**JMA Forecast API** (unofficial, free, Japan-only):
```
https://www.jma.go.jp/bosai/forecast/data/forecast/{area_code}.json
```
- No API key required
- 6-digit prefecture codes (e.g., `130000` = Tokyo) defined in [src/constants/areaCodes.ts](src/constants/areaCodes.ts)
- Full area list: https://www.jma.go.jp/bosai/common/const/area.json

**Nominatim API** (OpenStreetMap, rate-limited):
```
https://nominatim.openstreetmap.org/search?q={query}&countrycodes=jp&format=json
```
- 400ms debounce to respect rate limits
- Used for location search in settings

## Key Patterns

- **Caching**: 15-min weather cache in AsyncStorage to avoid redundant JMA API calls
- **Error handling**: `AppError` type with specific error types drives UI recovery options (retry, manual location selection)
- **Settings migration**: `storageService.loadSettings()` migrates old format (single origin/destination) to weekly schedule format
- **Responsive**: iPad-aware scaling (1.5x) throughout HomeScreen and SettingsScreen
