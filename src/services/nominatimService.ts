import { getAreaCodeFromPrefecture } from './locationService';

const NOMINATIM_BASE_URL = 'https://nominatim.openstreetmap.org/search';
const USER_AGENT = 'UmbrellaApp/1.1.0';

// Nominatim APIのアドレス詳細
export interface NominatimAddress {
  road?: string;
  neighbourhood?: string;
  suburb?: string;
  city?: string;
  town?: string;
  village?: string;
  county?: string;
  state?: string;        // 都道府県
  province?: string;     // 代替フィールド
  region?: string;       // 代替フィールド
  postcode?: string;
  country?: string;
  country_code?: string;
  // 特殊な場所タイプ
  railway?: string;
  station?: string;
  building?: string;
  amenity?: string;
}

// Nominatim APIのレスポンス
export interface NominatimResult {
  place_id: number;
  licence: string;
  osm_type: string;
  osm_id: number;
  boundingbox: string[];
  lat: string;
  lon: string;
  display_name: string;
  class: string;
  type: string;
  importance: number;
  address?: NominatimAddress;
}

// 検索結果の型
export interface LocationSearchResult {
  placeId: number;
  displayName: string;
  mainText: string;       // 場所名（短い）
  secondaryText: string;  // 住所詳細
  latitude: number;
  longitude: number;
  prefecture: string | null;
  areaCode: string | null;
}

// エラー型
export interface NominatimError {
  type: 'network' | 'no_results' | 'invalid_location' | 'rate_limit';
  message: string;
}

// 都道府県のリスト（display_nameからの抽出用）
const PREFECTURE_NAMES = [
  '北海道', '青森県', '岩手県', '宮城県', '秋田県', '山形県', '福島県',
  '茨城県', '栃木県', '群馬県', '埼玉県', '千葉県', '東京都', '神奈川県',
  '新潟県', '富山県', '石川県', '福井県', '山梨県', '長野県', '岐阜県',
  '静岡県', '愛知県', '三重県', '滋賀県', '京都府', '大阪府', '兵庫県',
  '奈良県', '和歌山県', '鳥取県', '島根県', '岡山県', '広島県', '山口県',
  '徳島県', '香川県', '愛媛県', '高知県', '福岡県', '佐賀県', '長崎県',
  '熊本県', '大分県', '宮崎県', '鹿児島県', '沖縄県',
];

// display_name から都道府県を抽出
const extractPrefectureFromDisplayName = (displayName: string): string | null => {
  for (const pref of PREFECTURE_NAMES) {
    if (displayName.includes(pref)) {
      return pref;
    }
  }
  return null;
};

// 都道府県を抽出
const extractPrefecture = (
  address: NominatimAddress | undefined,
  displayName?: string
): string | null => {
  // 1. addressオブジェクトから抽出を試みる
  if (address) {
    const prefecture = address.state || address.province || address.region;

    if (prefecture) {
      // 「都」「道」「府」「県」で終わっていれば都道府県として認識
      if (/[都道府県]$/.test(prefecture)) {
        return prefecture;
      }
      // 末尾に付いていない場合も一応返す（後でマッピングで検証）
      return prefecture;
    }
  }

  // 2. display_name からフォールバック抽出
  if (displayName) {
    return extractPrefectureFromDisplayName(displayName);
  }

  return null;
};

// 表示用のメインテキストを生成
const buildMainText = (result: NominatimResult): string => {
  const addr = result.address;
  if (!addr) {
    // display_name の最初の部分を使用
    const parts = result.display_name.split(',');
    return parts[0]?.trim() || result.display_name;
  }

  // 特殊な場所（駅、建物など）を優先
  const specialName = addr.railway || addr.station || addr.building || addr.amenity;
  if (specialName) {
    return specialName;
  }

  // 地域名を組み合わせ
  const locality = addr.suburb || addr.neighbourhood || addr.town || addr.village || addr.city;
  return locality || result.display_name.split(',')[0]?.trim() || '';
};

// 表示用のサブテキストを生成
const buildSecondaryText = (result: NominatimResult): string => {
  const addr = result.address;
  if (!addr) {
    const parts = result.display_name.split(',');
    return parts.slice(1, 3).join(',').trim();
  }

  const parts: string[] = [];

  if (addr.city || addr.town || addr.village) {
    parts.push(addr.city || addr.town || addr.village || '');
  }
  if (addr.county) {
    parts.push(addr.county);
  }
  if (addr.state) {
    parts.push(addr.state);
  }

  return parts.filter(Boolean).join(', ');
};

// Nominatim API で住所検索
export const searchAddress = async (
  query: string
): Promise<{ success: true; results: LocationSearchResult[] } | { success: false; error: NominatimError }> => {
  if (!query || query.trim().length < 2) {
    return {
      success: true,
      results: [],
    };
  }

  try {
    const params = new URLSearchParams({
      q: query,
      format: 'json',
      countrycodes: 'jp',  // 日本限定
      addressdetails: '1', // 住所詳細を取得
      limit: '8',          // 結果数を制限
      'accept-language': 'ja', // 日本語で結果を取得
    });

    const response = await fetch(`${NOMINATIM_BASE_URL}?${params}`, {
      headers: {
        'User-Agent': USER_AGENT,
      },
    });

    if (!response.ok) {
      if (response.status === 429) {
        return {
          success: false,
          error: {
            type: 'rate_limit',
            message: '検索回数の制限に達しました。しばらくしてから再試行してください',
          },
        };
      }
      throw new Error(`HTTP ${response.status}`);
    }

    const data: NominatimResult[] = await response.json();

    if (!Array.isArray(data) || data.length === 0) {
      return {
        success: true,
        results: [],
      };
    }

    // 結果を変換
    const rawResults: LocationSearchResult[] = data.map(item => {
      const prefecture = extractPrefecture(item.address, item.display_name);
      const areaCode = prefecture ? getAreaCodeFromPrefecture(prefecture) : null;

      return {
        placeId: item.place_id,
        displayName: item.display_name,
        mainText: buildMainText(item),
        secondaryText: buildSecondaryText(item),
        latitude: parseFloat(item.lat),
        longitude: parseFloat(item.lon),
        prefecture,
        areaCode,
      };
    });

    // 重複を除去（mainText + secondaryText + 座標で判定）
    // 座標は小数点以下3桁（約100m精度）で丸めて比較
    const seen = new Set<string>();
    const results = rawResults.filter(item => {
      const latRounded = item.latitude.toFixed(3);
      const lonRounded = item.longitude.toFixed(3);
      const key = `${item.mainText}|${item.secondaryText}|${latRounded},${lonRounded}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });

    // 都道府県が特定できた結果を優先してソート
    results.sort((a, b) => {
      if (a.areaCode && !b.areaCode) return -1;
      if (!a.areaCode && b.areaCode) return 1;
      return 0;
    });

    return {
      success: true,
      results,
    };
  } catch (error) {
    console.error('Nominatim検索エラー:', error);

    if (error instanceof TypeError && error.message.toLowerCase().includes('network')) {
      return {
        success: false,
        error: {
          type: 'network',
          message: 'インターネット接続を確認してください',
        },
      };
    }

    return {
      success: false,
      error: {
        type: 'network',
        message: '検索に失敗しました。再試行してください',
      },
    };
  }
};

// 座標から都道府県を逆ジオコーディング
export const reverseGeocode = async (
  latitude: number,
  longitude: number
): Promise<{ success: true; prefecture: string; areaCode: string } | { success: false; error: string }> => {
  try {
    const params = new URLSearchParams({
      lat: latitude.toString(),
      lon: longitude.toString(),
      format: 'json',
      addressdetails: '1',
      'accept-language': 'ja',
    });

    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?${params}`,
      {
        headers: {
          'User-Agent': USER_AGENT,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();

    if (!data) {
      return {
        success: false,
        error: '住所情報を取得できませんでした',
      };
    }

    const prefecture = extractPrefecture(data.address, data.display_name);
    if (!prefecture) {
      return {
        success: false,
        error: '都道府県を特定できませんでした',
      };
    }

    const areaCode = getAreaCodeFromPrefecture(prefecture);
    if (!areaCode) {
      return {
        success: false,
        error: '都道府県コードを特定できませんでした',
      };
    }

    return {
      success: true,
      prefecture,
      areaCode,
    };
  } catch (error) {
    console.error('逆ジオコーディングエラー:', error);
    return {
      success: false,
      error: '住所情報の取得に失敗しました',
    };
  }
};
