# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

傘判断アプリ (Umbrella Decision App) - A React Native/Expo app that tells users whether they need an umbrella based on weather forecasts from Japan Meteorological Agency (JMA) API.

## Development Commands

```bash
npm run start      # Start Expo dev server
npm run ios        # Run on iOS simulator
npm run android    # Run on Android emulator
npm run web        # Run in web browser
```

## Architecture

### Navigation & Entry
- [App.tsx](App.tsx) - Root component with React Navigation stack navigator (Home → Settings)
- Uses `@react-navigation/native-stack` for navigation

### Services Layer (`src/services/`)
- **weatherApi.ts** - Fetches weather from JMA API (`jma.go.jp/bosai/forecast/`), contains umbrella decision logic:
  - `determineUmbrella()` - Single location judgment (≥50% rain = required, ≥30% = recommended)
  - `determineCombinedUmbrella()` - Combined origin/destination judgment
- **locationService.ts** - GPS location + reverse geocoding to map coordinates to JMA area codes
- **notificationService.ts** - expo-notifications wrapper for daily umbrella reminders
- **storageService.ts** - AsyncStorage for settings persistence with 15-min weather cache

### Data Flow
1. GPS coordinates → reverse geocode → prefecture name → JMA area code (via `PREFECTURE_NAME_TO_CODE` map)
2. Area code → JMA API → weather forecast → umbrella decision
3. Supports origin + destination comparison for commute scenarios

### Key Types (`src/types/index.ts`)
- `UmbrellaDecision`: `'required' | 'recommended' | 'not_required'`
- `Location`: User-saved locations with area codes
- `Settings`: Notification prefs, outing times, origin/destination IDs

### Area Codes (`src/constants/areaCodes.ts`)
JMA uses 6-digit prefecture codes (e.g., `130000` = Tokyo). The app maps prefecture names to these codes for API calls.

## External API

**JMA Forecast API** (unofficial, free, Japan-only):
```
https://www.jma.go.jp/bosai/forecast/data/forecast/{area_code}.json
```
- No API key required
- Area codes from `src/constants/areaCodes.ts`
- Full area list: https://www.jma.go.jp/bosai/common/const/area.json

## Notes

- Language: Japanese (UI text, comments)
- No test framework configured yet
- No linting configured
- TypeScript strict mode enabled
