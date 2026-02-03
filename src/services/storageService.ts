import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Settings,
  JmaForecastResponse,
  isJmaForecastResponse,
  UmbrellaCriteria,
  DayOfWeek,
  DaySchedule,
  WeeklySchedule,
} from '../types';

const STORAGE_KEYS = {
  SETTINGS: '@umbrella_settings',
  WEATHER_CACHE: '@umbrella_weather_cache',
};

// デフォルトの傘判断基準
export const DEFAULT_UMBRELLA_CRITERIA: UmbrellaCriteria = {
  popThreshold: 50, // 降水確率50%以上
  precipitationThreshold: 1, // 降水量1mm以上
  logic: 'or', // どちらかの条件を満たせば傘必要
};

// 曜日名（日本語表示用）
export const DAY_NAMES: readonly string[] = ['日', '月', '火', '水', '木', '金', '土'];

// 単一曜日のデフォルト設定を生成
const createDefaultDaySchedule = (enabled: boolean): DaySchedule => ({
  enabled,
  originLocationId: null, // GPS
  destinationLocationId: null,
  outingStart: '09:00',
  outingEnd: '18:00',
});

// 週間デフォルト設定（土日は外出なし）
export const DEFAULT_WEEKLY_SCHEDULE: WeeklySchedule = {
  0: createDefaultDaySchedule(false), // 日曜
  1: createDefaultDaySchedule(true), // 月曜
  2: createDefaultDaySchedule(true), // 火曜
  3: createDefaultDaySchedule(true), // 水曜
  4: createDefaultDaySchedule(true), // 木曜
  5: createDefaultDaySchedule(true), // 金曜
  6: createDefaultDaySchedule(false), // 土曜
};

// デフォルト設定
export const DEFAULT_SETTINGS: Settings = {
  notificationEnabled: false,
  notificationTime: '07:00',
  notificationLeadTime: 30, // 外出30分前がデフォルト
  beforeOutingNotificationEnabled: false, // 外出前通知はデフォルトOFF
  defaultOutingStart: '09:00',
  defaultOutingEnd: '18:00',
  locations: [],
  selectedLocationId: null,
  originLocationId: null, // 出発地（null = GPS）
  destinationLocationId: null, // 目的地（null = 設定なし）
  umbrellaCriteria: DEFAULT_UMBRELLA_CRITERIA,
  weeklySchedule: DEFAULT_WEEKLY_SCHEDULE,
  showTemperature: true, // デフォルトで気温を表示
};

// 設定を保存
export const saveSettings = async (settings: Settings): Promise<void> => {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
  } catch (error) {
    console.error('設定の保存に失敗:', error);
    throw error;
  }
};

// 旧設定から曜日設定へのマイグレーション
const migrateToWeeklySchedule = (oldSettings: Partial<Settings>): WeeklySchedule => {
  const baseSchedule: DaySchedule = {
    enabled: true,
    originLocationId: oldSettings.originLocationId ?? null,
    destinationLocationId: oldSettings.destinationLocationId ?? null,
    outingStart: oldSettings.defaultOutingStart ?? '09:00',
    outingEnd: oldSettings.defaultOutingEnd ?? '18:00',
  };

  return {
    0: { ...baseSchedule, enabled: false }, // 日曜は外出なし
    1: { ...baseSchedule },
    2: { ...baseSchedule },
    3: { ...baseSchedule },
    4: { ...baseSchedule },
    5: { ...baseSchedule },
    6: { ...baseSchedule, enabled: false }, // 土曜は外出なし
  };
};

// 設定を読み込み
export const loadSettings = async (): Promise<Settings> => {
  try {
    const json = await AsyncStorage.getItem(STORAGE_KEYS.SETTINGS);
    if (json) {
      const saved = JSON.parse(json);

      // weeklyScheduleのマイグレーション
      let weeklySchedule: WeeklySchedule;
      if (saved.weeklySchedule) {
        // 既存の曜日設定がある場合はマージ
        weeklySchedule = {
          ...DEFAULT_WEEKLY_SCHEDULE,
          ...saved.weeklySchedule,
        };
      } else {
        // 古い設定から曜日設定を生成（マイグレーション）
        weeklySchedule = migrateToWeeklySchedule(saved);
      }

      // notificationModeのマイグレーション（排他モード → 独立トグル）
      if (saved.notificationMode !== undefined && saved.beforeOutingNotificationEnabled === undefined) {
        if (saved.notificationMode === 'beforeOuting') {
          saved.beforeOutingNotificationEnabled = saved.notificationEnabled ?? false;
          saved.notificationEnabled = false;
        } else {
          saved.beforeOutingNotificationEnabled = false;
        }
        delete saved.notificationMode;
      }

      // umbrellaCriteriaの後方互換性を確保
      return {
        ...DEFAULT_SETTINGS,
        ...saved,
        umbrellaCriteria: {
          ...DEFAULT_UMBRELLA_CRITERIA,
          ...(saved.umbrellaCriteria || {}),
        },
        weeklySchedule,
      };
    }
    return DEFAULT_SETTINGS;
  } catch (error) {
    console.error('設定の読み込みに失敗:', error);
    return DEFAULT_SETTINGS;
  }
};

// 現在の曜日の設定を取得
export const getTodaySchedule = (settings: Settings): DaySchedule | null => {
  const dayOfWeek = new Date().getDay() as DayOfWeek;
  return getDaySchedule(settings, dayOfWeek);
};

// 翌日の曜日設定を取得
export const getTomorrowSchedule = (settings: Settings): DaySchedule | null => {
  const today = new Date().getDay();
  const tomorrow = ((today + 1) % 7) as DayOfWeek;
  return getDaySchedule(settings, tomorrow);
};

// 指定曜日の設定を取得
export const getDaySchedule = (
  settings: Settings,
  dayOfWeek: DayOfWeek
): DaySchedule | null => {
  const schedule = settings.weeklySchedule?.[dayOfWeek];

  if (!schedule || !schedule.enabled) {
    return null; // 外出予定なし
  }

  return schedule;
};

// 天気キャッシュを保存（15分有効）
interface WeatherCache<T> {
  data: T;
  timestamp: number;
  areaCode: string;
}

export const saveWeatherCache = async (
  areaCode: string,
  data: JmaForecastResponse
): Promise<void> => {
  try {
    const cache: WeatherCache<JmaForecastResponse> = {
      data,
      timestamp: Date.now(),
      areaCode,
    };
    await AsyncStorage.setItem(
      `${STORAGE_KEYS.WEATHER_CACHE}_${areaCode}`,
      JSON.stringify(cache)
    );
  } catch (error) {
    console.error('天気キャッシュの保存に失敗:', error);
  }
};

export const loadWeatherCache = async (areaCode: string): Promise<JmaForecastResponse | null> => {
  try {
    const json = await AsyncStorage.getItem(`${STORAGE_KEYS.WEATHER_CACHE}_${areaCode}`);
    if (!json) return null;

    const cache = JSON.parse(json) as WeatherCache<unknown>;
    // 15分以内のキャッシュのみ有効
    if (Date.now() - cache.timestamp >= 15 * 60 * 1000) return null;

    // キャッシュも型ガードで検証
    if (!isJmaForecastResponse(cache.data)) {
      console.warn('天気キャッシュの形式が不正:', cache.data);
      return null;
    }

    return cache.data;
  } catch (error) {
    console.error('天気キャッシュの読み込みに失敗:', error);
    return null;
  }
};
