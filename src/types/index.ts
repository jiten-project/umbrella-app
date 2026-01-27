// 天気予報データの型
export interface WeatherForecast {
  areaCode: string;
  areaName: string;
  publishingOffice: string;
  reportDatetime: string;
  timeSeries: TimeSeriesItem[];
}

export interface TimeSeriesItem {
  timeDefines: string[];
  areas: AreaForecast[];
}

export interface AreaForecast {
  area: {
    name: string;
    code: string;
  };
  weatherCodes?: string[];
  weathers?: string[];
  winds?: string[];
  waves?: string[];
  pops?: string[]; // 降水確率
  precipitation?: string[]; // 降水量(mm)
  precipitations?: string[]; // API差分吸収用
  temps?: string[];
  tempsMin?: string[];
  tempsMax?: string[];
}

// 傘判断結果
export type UmbrellaDecision = 'required' | 'recommended' | 'not_required';

// エラー種別（UIの表示切替に利用）
export type AppErrorType = 'offline' | 'api' | 'permission' | 'manual_location' | 'unknown';

export interface AppError {
  type: AppErrorType;
  message: string;
}

// AppError かどうかを判定する型ガード
export const isAppError = (value: unknown): value is AppError =>
  typeof value === 'object' &&
  value !== null &&
  'type' in value &&
  'message' in value &&
  typeof (value as AppError).type === 'string' &&
  typeof (value as AppError).message === 'string';

export interface UmbrellaResult {
  decision: UmbrellaDecision;
  message: string;
  maxPop: number; // 最大降水確率
  hourlyForecasts: HourlyForecast[];
}

// 地点別の傘判断結果
export interface LocationUmbrellaResult {
  location: Location;
  result: UmbrellaResult;
}

// 総合判断結果（出発地・目的地両方を考慮）
export interface CombinedUmbrellaResult {
  overallDecision: UmbrellaDecision;
  overallMessage: string;
  origin?: LocationUmbrellaResult; // 出発地
  destination?: LocationUmbrellaResult; // 目的地
}

export interface HourlyForecast {
  time: string;
  weather: string;
  weatherCode: string;
  pop: number; // 降水確率
  precipitation: number; // 降水量(mm)
}

// 位置情報
export interface Location {
  id: string;
  name: string;
  areaCode: string;
  isGPS: boolean;
  latitude?: number;
  longitude?: number;
}

// 傘判断の条件タイプ（AND: 両方満たす, OR: どちらか満たす）
export type UmbrellaCriteriaLogic = 'and' | 'or';

// 傘判断の基準設定
export interface UmbrellaCriteria {
  popThreshold: number; // 降水確率の閾値（%）
  precipitationThreshold: number; // 降水量の閾値（mm）
  logic: UmbrellaCriteriaLogic; // AND/OR条件
}

// 曜日の型（JavaScriptのDate.getDay()と同じ: 0=日曜〜6=土曜）
export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6;

// 曜日ごとの設定
export interface DaySchedule {
  enabled: boolean; // この曜日に外出予定があるか
  originLocationId: string | null; // 出発地（null = GPS）
  destinationLocationId: string | null; // 目的地（null = 設定なし）
  outingStart: string; // "09:00" 形式
  outingEnd: string; // "18:00" 形式
}

// 曜日 → 設定 のマップ
export type WeeklySchedule = {
  [key in DayOfWeek]: DaySchedule;
};

// 設定
export interface Settings {
  notificationEnabled: boolean;
  notificationTime: string; // "07:00" format
  defaultOutingStart: string; // "09:00" format（後方互換性）
  defaultOutingEnd: string; // "18:00" format（後方互換性）
  locations: Location[];
  selectedLocationId: string | null; // 後方互換性のため残す
  originLocationId: string | null; // 出発地（後方互換性、null = GPS）
  destinationLocationId: string | null; // 目的地（後方互換性、null = 設定なし）
  umbrellaCriteria: UmbrellaCriteria; // 傘判断基準
  weeklySchedule?: WeeklySchedule; // 曜日ごとの設定（オプショナルで後方互換性確保）
}

// 外出時間
export interface OutingTime {
  start: string; // "09:00" format
  end: string; // "18:00" format
}

// JMA APIレスポンスの型
export interface JmaForecastItem {
  publishingOffice: string;
  reportDatetime: string;
  timeSeries: TimeSeriesItem[];
}
export type JmaForecastResponse = JmaForecastItem[];

// 型ガードのヘルパー関数
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every(item => typeof item === 'string');

const isAreaForecast = (value: unknown): value is AreaForecast => {
  if (!isRecord(value)) return false;
  if (!isRecord(value.area)) return false;
  if (typeof value.area.name !== 'string' || typeof value.area.code !== 'string') return false;

  const optionalArrayKeys: Array<keyof AreaForecast> = [
    'weatherCodes',
    'weathers',
    'winds',
    'waves',
    'pops',
    'temps',
    'tempsMin',
    'tempsMax',
    'precipitation',
    'precipitations',
  ];

  return optionalArrayKeys.every(key => {
    const raw = value[key];
    return raw === undefined || isStringArray(raw);
  });
};

// JMA APIレスポンスを検証する型ガード
export const isJmaForecastResponse = (value: unknown): value is JmaForecastResponse => {
  if (!Array.isArray(value) || value.length === 0) return false;

  return value.every(item => {
    if (!isRecord(item)) return false;
    if (typeof item.publishingOffice !== 'string') return false;
    if (typeof item.reportDatetime !== 'string') return false;
    if (!Array.isArray(item.timeSeries) || item.timeSeries.length === 0) return false;

    return item.timeSeries.every(series => {
      if (!isRecord(series)) return false;
      if (!isStringArray(series.timeDefines)) return false;
      if (!Array.isArray(series.areas) || series.areas.length === 0) return false;
      return series.areas.every(isAreaForecast);
    });
  });
};
