import AsyncStorage from '@react-native-async-storage/async-storage';
import { Settings, JmaForecastResponse, isJmaForecastResponse, UmbrellaCriteria } from '../types';

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

// デフォルト設定
export const DEFAULT_SETTINGS: Settings = {
  notificationEnabled: false,
  notificationTime: '07:00',
  defaultOutingStart: '09:00',
  defaultOutingEnd: '18:00',
  locations: [],
  selectedLocationId: null,
  originLocationId: null, // 出発地（null = GPS）
  destinationLocationId: null, // 目的地（null = 設定なし）
  umbrellaCriteria: DEFAULT_UMBRELLA_CRITERIA,
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

// 設定を読み込み
export const loadSettings = async (): Promise<Settings> => {
  try {
    const json = await AsyncStorage.getItem(STORAGE_KEYS.SETTINGS);
    if (json) {
      const saved = JSON.parse(json);
      // umbrellaCriteriaの後方互換性を確保
      return {
        ...DEFAULT_SETTINGS,
        ...saved,
        umbrellaCriteria: {
          ...DEFAULT_UMBRELLA_CRITERIA,
          ...(saved.umbrellaCriteria || {}),
        },
      };
    }
    return DEFAULT_SETTINGS;
  } catch (error) {
    console.error('設定の読み込みに失敗:', error);
    return DEFAULT_SETTINGS;
  }
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
