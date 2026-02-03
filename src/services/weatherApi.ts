import {
  WeatherForecast,
  HourlyForecast,
  UmbrellaResult,
  UmbrellaDecision,
  OutingTime,
  LocationUmbrellaResult,
  CombinedUmbrellaResult,
  JmaForecastResponse,
  AreaForecast,
  TimeSeriesItem,
  isJmaForecastResponse,
  AppError,
  AppErrorType,
  isAppError,
  UmbrellaCriteria,
  TemperatureData,
} from '../types';
import { loadWeatherCache, saveWeatherCache } from './storageService';

const JMA_BASE_URL = 'https://www.jma.go.jp/bosai/forecast/data/forecast';

// AppError を組み立てる
const buildAppError = (type: AppErrorType, message: string): AppError => ({ type, message });

// オフライン判定はエラーメッセージから推測
const isOfflineError = (error: unknown): boolean => {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return (
    message.includes('network') ||
    message.includes('failed to fetch') ||
    message.includes('request failed') ||
    message.includes('timeout')
  );
};

// "HH:MM" を分に変換
const parseTimeToMinutes = (time: string): number => {
  const [hour, minute] = time.split(':').map(Number);
  return hour * 60 + (minute || 0);
};

// 日跨ぎの時間帯を判定（例: 22:30-01:00）
const isWithinOutingWindow = (
  minutes: number,
  startMinutes: number,
  endMinutes: number
): boolean => {
  if (startMinutes === endMinutes) return true; // 同一時刻は終日扱い
  if (startMinutes < endMinutes) {
    // 通常の時間帯（例: 09:00-18:00）
    return minutes >= startMinutes && minutes <= endMinutes;
  }
  // 日跨ぎの場合（例: 22:00-02:00）は「開始以降」または「終了以前」
  return minutes >= startMinutes || minutes <= endMinutes;
};

// areaCodeに一致する地域を優先的に選択（見つからなければ先頭へフォールバック）
const pickAreaByCode = (areas: AreaForecast[], areaCode: string): AreaForecast | undefined => {
  // 完全一致
  const exact = areas.find(area => area.area.code === areaCode);
  if (exact) return exact;

  // 県コードと地域コードのプレフィックス一致を許容
  const prefix = areas.find(area => area.area.code.startsWith(areaCode.substring(0, 2)));
  return prefix ?? areas[0];
};

// timeSeries内から目的の配列を持つseriesを探索
const findTimeSeriesByKeys = (
  timeSeries: TimeSeriesItem[],
  keys: Array<keyof AreaForecast>
): TimeSeriesItem | undefined =>
  timeSeries.find(series =>
    series.areas.some(area => keys.some(key => Array.isArray(area[key])))
  );

// 数値パース（安全に変換）
const parseNumber = (value?: string): number => {
  if (value === undefined || value === null || value === '') return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

// 降水量配列を取得（API差分吸収）
const getPrecipitations = (area?: AreaForecast): string[] => {
  if (!area) return [];
  if (Array.isArray(area.precipitation)) return area.precipitation;
  if (Array.isArray(area.precipitations)) return area.precipitations;
  return [];
};

// 時間→値のマップを構築
const buildValueMap = (series?: TimeSeriesItem, values: string[] = []): Map<string, number> => {
  const map = new Map<string, number>();
  if (!series || !Array.isArray(series.timeDefines)) return map;

  series.timeDefines.forEach((timeStr, index) => {
    map.set(timeStr, parseNumber(values[index]));
  });
  return map;
};

// APIレスポンスを解析
const parseWeatherData = (
  data: JmaForecastResponse,
  areaCode: string
): WeatherForecast | null => {
  if (!Array.isArray(data) || data.length === 0) {
    console.warn('JMA APIレスポンスが空です');
    return null;
  }

  const forecast = data[0]; // 最初の要素が今日〜明日の予報
  if (!forecast || !Array.isArray(forecast.timeSeries) || forecast.timeSeries.length === 0) {
    console.warn('timeSeriesが存在しません');
    return null;
  }

  const weatherSeries = findTimeSeriesByKeys(forecast.timeSeries, ['weatherCodes', 'weathers'])
    ?? forecast.timeSeries[0];

  if (!weatherSeries || !Array.isArray(weatherSeries.areas) || weatherSeries.areas.length === 0) {
    console.warn('areasが存在しません');
    return null;
  }

  const weatherArea = pickAreaByCode(weatherSeries.areas, areaCode);
  if (!weatherArea) {
    console.warn('areaCodeに一致する地域が見つかりません:', areaCode);
    return null;
  }

  return {
    areaCode,
    areaName: weatherArea.area.name,
    publishingOffice: forecast.publishingOffice,
    reportDatetime: forecast.reportDatetime,
    timeSeries: forecast.timeSeries,
  };
};

// 気象庁APIから天気予報を取得（エラー時はAppErrorをthrow）
export const fetchWeatherForecast = async (areaCode: string): Promise<WeatherForecast> => {
  try {
    // 先にキャッシュを利用
    const cached = await loadWeatherCache(areaCode);
    if (cached) {
      const cachedForecast = parseWeatherData(cached, areaCode);
      if (cachedForecast) return cachedForecast;
    }

    const response = await fetch(`${JMA_BASE_URL}/${areaCode}.json`);
    if (!response.ok) {
      throw buildAppError('api', `天気情報の取得に失敗しました（HTTP ${response.status}）`);
    }

    const data: unknown = await response.json();
    if (!isJmaForecastResponse(data)) {
      throw buildAppError('api', '天気情報の形式が想定外でした');
    }

    await saveWeatherCache(areaCode, data);
    const parsed = parseWeatherData(data, areaCode);
    if (!parsed) {
      throw buildAppError('api', '天気情報の解析に失敗しました');
    }

    return parsed;
  } catch (error) {
    console.error('天気データの取得に失敗しました:', error);
    if (isAppError(error)) throw error;
    if (isOfflineError(error)) {
      throw buildAppError('offline', 'オフラインのため天気情報を取得できませんでした');
    }
    throw buildAppError('api', '天気情報の取得に失敗しました');
  }
};

// 時間帯別の予報を抽出（外出時間を3等分して4点表示）
export const extractHourlyForecasts = (
  forecast: WeatherForecast,
  outingTime: OutingTime
): HourlyForecast[] => {
  const hourlyForecasts: HourlyForecast[] = [];

  // timeSeries[0]は天気、timeSeries[1]は降水確率
  const weatherSeries = findTimeSeriesByKeys(forecast.timeSeries, ['weatherCodes', 'weathers']);
  const popSeries = findTimeSeriesByKeys(forecast.timeSeries, ['pops']);
  const precipitationSeries = findTimeSeriesByKeys(forecast.timeSeries, [
    'precipitation',
    'precipitations',
  ]);

  if (!weatherSeries || !popSeries) {
    return hourlyForecasts;
  }

  const weatherArea = pickAreaByCode(weatherSeries.areas, forecast.areaCode);
  const popArea = pickAreaByCode(popSeries.areas, forecast.areaCode);
  const precipitationArea = precipitationSeries
    ? pickAreaByCode(precipitationSeries.areas, forecast.areaCode)
    : undefined;

  if (!weatherArea || !popArea) {
    return hourlyForecasts;
  }

  // 降水確率の時間定義と値を処理
  const popTimeDefines = popSeries.timeDefines || [];
  const pops = popArea.pops || [];
  const precipitationByTime = buildValueMap(
    precipitationSeries,
    getPrecipitations(precipitationArea)
  );

  // 時刻→降水確率のマップを作成（時間のみで管理）
  const popByHour = new Map<number, number>();
  const precipByHour = new Map<number, number>();

  popTimeDefines.forEach((timeStr: string, index: number) => {
    const time = new Date(timeStr);
    const hour = time.getHours();
    // 今日のデータのみ使用（最初に見つかったものを優先）
    if (!popByHour.has(hour)) {
      popByHour.set(hour, parseNumber(pops[index]));
      precipByHour.set(hour, precipitationByTime.get(timeStr) ?? 0);
    }
  });

  // 外出時間を3等分して4つの時刻を生成
  const startMinutes = parseTimeToMinutes(outingTime.start);
  const endMinutes = parseTimeToMinutes(outingTime.end);

  // 時間の長さを計算
  const duration = endMinutes >= startMinutes
    ? endMinutes - startMinutes
    : (24 * 60 - startMinutes) + endMinutes; // 日跨ぎの場合

  // 4つの時刻を計算（開始、1/3、2/3、終了）
  const timePoints = [0, 1/3, 2/3, 1].map(ratio => {
    let minutes = startMinutes + Math.round(duration * ratio);
    if (minutes >= 24 * 60) {
      minutes -= 24 * 60;
    }
    return minutes;
  });

  // 各時刻に対して最も近い予報データを取得
  timePoints.forEach(minutes => {
    const hour = Math.floor(minutes / 60);
    const minute = minutes % 60;

    // 最も近い時間帯の降水確率を取得
    let closestPop = 0;
    let closestPrecip = 0;
    let minDiff = Infinity;

    popByHour.forEach((pop, h) => {
      const diff = Math.abs(h - hour);
      if (diff < minDiff) {
        minDiff = diff;
        closestPop = pop;
        closestPrecip = precipByHour.get(h) ?? 0;
      }
    });

    // 時刻ラベルを生成
    const hourStr = hour.toString().padStart(2, '0');
    const minuteStr = minute.toString().padStart(2, '0');
    const timeLabel = `${hourStr}:${minuteStr}`;

    hourlyForecasts.push({
      time: timeLabel,
      weather: weatherArea.weathers?.[0] || '',
      weatherCode: weatherArea.weatherCodes?.[0] || '100',
      pop: closestPop,
      precipitation: closestPrecip,
    });
  });

  return hourlyForecasts;
};

// デフォルトの傘判断基準
const DEFAULT_CRITERIA: UmbrellaCriteria = {
  popThreshold: 50,
  precipitationThreshold: 1,
  logic: 'or',
};

// 傘の要否を判断
export const determineUmbrella = (
  forecast: WeatherForecast,
  outingTime: OutingTime,
  criteria: UmbrellaCriteria = DEFAULT_CRITERIA
): UmbrellaResult => {
  const hourlyForecasts = extractHourlyForecasts(forecast, outingTime);

  // 最大降水確率を取得
  const maxPop = hourlyForecasts.length > 0
    ? Math.max(...hourlyForecasts.map(f => f.pop))
    : 0;

  // 降水量の最大値を取得
  const maxPrecipitation = hourlyForecasts.length > 0
    ? Math.max(...hourlyForecasts.map(f => f.precipitation))
    : 0;

  // ユーザー設定の閾値で判断
  const popExceedsThreshold = maxPop >= criteria.popThreshold;
  const precipExceedsThreshold = maxPrecipitation >= criteria.precipitationThreshold;

  // AND/OR ロジックで傘が必要かを判断
  const umbrellaRequired =
    criteria.logic === 'or'
      ? popExceedsThreshold || precipExceedsThreshold
      : popExceedsThreshold && precipExceedsThreshold;

  let decision: UmbrellaDecision;
  let message: string;

  if (umbrellaRequired) {
    decision = 'required';
    if (popExceedsThreshold && precipExceedsThreshold) {
      message = `傘を持っていこう（${maxPop}%・${maxPrecipitation}mm）`;
    } else if (precipExceedsThreshold) {
      message = `傘を持っていこう（降水量${maxPrecipitation}mm）`;
    } else {
      message = `傘を持っていこう（${maxPop}%）`;
    }
  } else if (maxPop >= criteria.popThreshold * 0.6) {
    // 閾値の60%以上なら「念のため」
    decision = 'recommended';
    message = '念のため折りたたみ傘を';
  } else {
    decision = 'not_required';
    message = '傘は不要';
  }

  return {
    decision,
    message,
    maxPop,
    hourlyForecasts,
  };
};

// 出発地・目的地の両方を考慮した総合判断
export const determineCombinedUmbrella = (
  originResult?: LocationUmbrellaResult,
  destinationResult?: LocationUmbrellaResult
): CombinedUmbrellaResult => {
  // 両方ない場合
  if (!originResult && !destinationResult) {
    return {
      overallDecision: 'not_required',
      overallMessage: '地点を設定してください',
      origin: undefined,
      destination: undefined,
    };
  }

  // どちらか一方のみの場合
  if (!originResult && destinationResult) {
    return {
      overallDecision: destinationResult.result.decision,
      overallMessage: destinationResult.result.message,
      origin: undefined,
      destination: destinationResult,
    };
  }

  if (originResult && !destinationResult) {
    return {
      overallDecision: originResult.result.decision,
      overallMessage: originResult.result.message,
      origin: originResult,
      destination: undefined,
    };
  }

  // 両方ある場合は、より厳しい判断を採用
  const decisions: UmbrellaDecision[] = [
    originResult!.result.decision,
    destinationResult!.result.decision,
  ];

  let overallDecision: UmbrellaDecision;
  let overallMessage: string;

  if (decisions.includes('required')) {
    overallDecision = 'required';
    // どちらの地点で傘が必要かを明示
    const needsOrigin = originResult!.result.decision === 'required';
    const needsDest = destinationResult!.result.decision === 'required';
    if (needsOrigin && needsDest) {
      overallMessage = '両方の地点で傘が必要';
    } else if (needsOrigin) {
      overallMessage = `${originResult!.location.name}で傘が必要`;
    } else {
      overallMessage = `${destinationResult!.location.name}で傘が必要`;
    }
  } else if (decisions.includes('recommended')) {
    overallDecision = 'recommended';
    // recommendedでも地点を明示
    const recOrigin = originResult!.result.decision === 'recommended';
    const recDest = destinationResult!.result.decision === 'recommended';
    if (recOrigin && recDest) {
      overallMessage = '念のため折りたたみ傘を';
    } else if (recOrigin) {
      overallMessage = `${originResult!.location.name}で念のため傘を`;
    } else {
      overallMessage = `${destinationResult!.location.name}で念のため傘を`;
    }
  } else {
    overallDecision = 'not_required';
    overallMessage = '傘は不要';
  }

  return {
    overallDecision,
    overallMessage,
    origin: originResult,
    destination: destinationResult,
  };
};

// 気温データを抽出
export const extractTemperature = (forecast: WeatherForecast): TemperatureData => {
  // timeSeries[2]に気温データがあることが多い
  const tempSeries = findTimeSeriesByKeys(forecast.timeSeries, ['temps', 'tempsMin', 'tempsMax']);

  if (!tempSeries) {
    return { min: null, max: null };
  }

  const tempArea = pickAreaByCode(tempSeries.areas, forecast.areaCode);
  if (!tempArea) {
    return { min: null, max: null };
  }

  // temps配列から最低・最高気温を取得
  // JMA APIでは通常、temps[0]が最低気温、temps[1]が最高気温
  // または tempsMin/tempsMax が使われる
  let min: number | null = null;
  let max: number | null = null;

  if (tempArea.tempsMin && tempArea.tempsMin.length > 0) {
    const parsed = parseNumber(tempArea.tempsMin[0]);
    if (parsed !== 0 || tempArea.tempsMin[0] === '0') {
      min = parsed;
    }
  }

  if (tempArea.tempsMax && tempArea.tempsMax.length > 0) {
    const parsed = parseNumber(tempArea.tempsMax[0]);
    if (parsed !== 0 || tempArea.tempsMax[0] === '0') {
      max = parsed;
    }
  }

  // tempsMin/tempsMaxがない場合はtempsから取得
  if (min === null && max === null && tempArea.temps && tempArea.temps.length >= 2) {
    const temp0 = parseNumber(tempArea.temps[0]);
    const temp1 = parseNumber(tempArea.temps[1]);

    // 空文字チェック（APIが空の場合がある）
    if (tempArea.temps[0] !== '') {
      min = temp0;
    }
    if (tempArea.temps[1] !== '') {
      max = temp1;
    }
  }

  return { min, max };
};
