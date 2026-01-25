import * as ExpoLocation from 'expo-location';
import { PREFECTURE_NAME_TO_CODE } from '../constants/areaCodes';
import { AppErrorType } from '../types';

export interface GeoLocation {
  latitude: number;
  longitude: number;
}

export interface LocationResult {
  success: boolean;
  location?: GeoLocation;
  areaCode?: string;
  areaName?: string;
  errorType?: AppErrorType;
  error?: string;
}

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

// 位置情報エラーを分類
const classifyLocationError = (error: unknown): AppErrorType =>
  isOfflineError(error) ? 'offline' : 'api';

// 位置情報の許可を要求
export const requestLocationPermission = async (): Promise<boolean> => {
  const { status } = await ExpoLocation.requestForegroundPermissionsAsync();
  return status === 'granted';
};

// 現在位置を取得
export const getCurrentLocation = async (): Promise<LocationResult> => {
  try {
    const hasPermission = await requestLocationPermission();
    if (!hasPermission) {
      return {
        success: false,
        errorType: 'permission',
        error: '位置情報の許可が必要です',
      };
    }

    const location = await ExpoLocation.getCurrentPositionAsync({
      accuracy: ExpoLocation.Accuracy.Balanced,
    });

    const geoLocation: GeoLocation = {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
    };

    // 逆ジオコーディングで住所を取得
    const addresses = await ExpoLocation.reverseGeocodeAsync(geoLocation);

    if (addresses.length > 0) {
      const address = addresses[0];
      const prefecture = address.region || address.subregion || '';
      const areaCode = prefecture ? getAreaCodeFromPrefecture(prefecture) : null;
      const areaName = [prefecture, address.city, address.district]
        .filter(Boolean)
        .join('');

      if (areaCode) {
        return {
          success: true,
          location: geoLocation,
          areaCode,
          areaName: areaName || '現在地',
        };
      }

      // 都道府県が特定できない場合は手動設定へ誘導
      return {
        success: false,
        location: geoLocation,
        areaName: areaName || '現在地',
        errorType: 'manual_location',
        error: '都道府県を特定できませんでした。設定で出発地を選択してください',
      };
    }

    // 住所情報が取得できない場合も手動設定へ誘導
    return {
      success: false,
      location: geoLocation,
      areaName: '現在地',
      errorType: 'manual_location',
      error: '住所情報を取得できませんでした。設定で出発地を選択してください',
    };
  } catch (error) {
    console.error('位置情報の取得に失敗:', error);
    const errorType = classifyLocationError(error);
    return {
      success: false,
      errorType,
      error:
        errorType === 'offline'
          ? 'オフラインのため位置情報を取得できませんでした'
          : '位置情報を取得できませんでした',
    };
  }
};

// 都道府県名からエリアコードを取得（見つからない場合はnull）
export const getAreaCodeFromPrefecture = (prefecture: string): string | null => {
  if (!prefecture) return null;

  // 「都」「道」「府」「県」を除去して検索
  const normalizedName = prefecture.replace(/[都道府県]$/, '');

  for (const [name, code] of Object.entries(PREFECTURE_NAME_TO_CODE)) {
    if (
      name.includes(normalizedName) ||
      normalizedName.includes(name.replace(/[都道府県]$/, ''))
    ) {
      return code;
    }
  }

  // 見つからない場合は手動設定に回す
  return null;
};
