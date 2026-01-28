import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { TimePickerModal } from '../components/TimePickerModal';
import {
  fetchWeatherForecast,
  determineUmbrella,
  determineCombinedUmbrella,
} from '../services/weatherApi';
import { getCurrentLocation } from '../services/locationService';
import {
  loadSettings,
  saveSettings,
  getTodaySchedule,
  DAY_NAMES,
} from '../services/storageService';
import { DayOfWeek } from '../types';
import {
  CombinedUmbrellaResult,
  Settings,
  OutingTime,
  Location,
  LocationUmbrellaResult,
  AppError,
  AppErrorType,
  isAppError,
} from '../types';

type RootStackParamList = {
  Home: undefined;
  Settings: undefined;
};

export const HomeScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { width } = useWindowDimensions();

  // iPad判定（幅768px以上をiPadとみなす）
  const isTablet = width >= 768;
  const scale = isTablet ? 1.5 : 1;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [combinedResult, setCombinedResult] = useState<CombinedUmbrellaResult | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState<AppError | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);

  // 外出時間設定モーダル
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [outingTime, setOutingTime] = useState<OutingTime>({
    start: '09:00',
    end: '18:00',
  });

  // 例外を AppError に正規化
  const normalizeError = (value: unknown): AppError => {
    if (isAppError(value)) return value;
    if (value instanceof Error) {
      return { type: 'unknown', message: value.message };
    }
    return { type: 'unknown', message: '予期しないエラーが発生しました' };
  };

  // エラー種別ごとのアイコンを決定
  const getErrorIcon = (type: AppErrorType): string => {
    switch (type) {
      case 'offline':
        return '📡';
      case 'api':
        return '🛰️';
      case 'permission':
        return '🔒';
      case 'manual_location':
        return '🗺️';
      default:
        return '⚠️';
    }
  };

  // エラー種別ごとのメッセージを決定
  const getErrorMessage = (appError: AppError): string => {
    switch (appError.type) {
      case 'offline':
        return 'オフラインのため天気情報を取得できませんでした。\n通信状態を確認してください。';
      case 'api':
        return '天気情報の取得に失敗しました。\nしばらくしてから再試行してください。';
      case 'permission':
        return '位置情報の権限が必要です。\n設定から許可してください。';
      case 'manual_location':
        return '都道府県を特定できませんでした。\n設定で出発地を手動選択してください。';
      default:
        return appError.message || '予期しないエラーが発生しました';
    }
  };

  const fetchData = useCallback(async () => {
    try {
      setError(null);

      // 設定を読み込み
      const loadedSettings = await loadSettings();
      setSettings(loadedSettings);

      // 今日の曜日設定を取得
      const todaySchedule = getTodaySchedule(loadedSettings);

      // 外出予定がない場合
      if (!todaySchedule) {
        const dayOfWeek = new Date().getDay() as DayOfWeek;
        setOutingTime({ start: '', end: '' });
        setCombinedResult({
          overallDecision: 'not_required',
          overallMessage: `${DAY_NAMES[dayOfWeek]}曜日は外出予定がありません`,
          origin: undefined,
          destination: undefined,
        });
        return;
      }

      // 曜日設定から外出時間を設定
      setOutingTime({
        start: todaySchedule.outingStart,
        end: todaySchedule.outingEnd,
      });

      let originResult: LocationUmbrellaResult | undefined;
      let destinationResult: LocationUmbrellaResult | undefined;

      // 外出時間の設定（曜日設定から取得）
      const outingTimeSettings = {
        start: todaySchedule.outingStart,
        end: todaySchedule.outingEnd,
      };

      // 出発地の天気を取得（曜日設定の出発地を使用）
      if (todaySchedule.originLocationId) {
        // 登録済み地点を使用
        const originLocation = loadedSettings.locations.find(
          (loc) => loc.id === todaySchedule.originLocationId
        );
        if (originLocation) {
          const forecast = await fetchWeatherForecast(originLocation.areaCode);
          originResult = {
            location: originLocation,
            result: determineUmbrella(
              forecast,
              outingTimeSettings,
              loadedSettings.umbrellaCriteria
            ),
          };
        }
      } else {
        // GPS で現在地を取得
        const locationResult = await getCurrentLocation();

        if (!locationResult.success) {
          // manual_location / permission / offline をここでハンドリング
          setError({
            type: locationResult.errorType ?? 'unknown',
            message: locationResult.error ?? '位置情報を取得できませんでした',
          });
          return;
        }

        if (!locationResult.areaCode) {
          // 念のためのガード（都道府県が取れない場合）
          setError({
            type: 'manual_location',
            message: '都道府県を特定できませんでした。設定で出発地を手動選択してください。',
          });
          return;
        }

        const gpsLocation: Location = {
          id: 'gps',
          name: locationResult.areaName || '現在地',
          areaCode: locationResult.areaCode,
          isGPS: true,
        };

        const forecast = await fetchWeatherForecast(locationResult.areaCode);
        originResult = {
          location: gpsLocation,
          result: determineUmbrella(
            forecast,
            outingTimeSettings,
            loadedSettings.umbrellaCriteria
          ),
        };
      }

      // 目的地の天気を取得（曜日設定の目的地を使用）
      if (todaySchedule.destinationLocationId) {
        const destLocation = loadedSettings.locations.find(
          (loc) => loc.id === todaySchedule.destinationLocationId
        );
        if (destLocation) {
          const forecast = await fetchWeatherForecast(destLocation.areaCode);
          destinationResult = {
            location: destLocation,
            result: determineUmbrella(
              forecast,
              outingTimeSettings,
              loadedSettings.umbrellaCriteria
            ),
          };
        }
      }

      // 総合判断
      const combined = determineCombinedUmbrella(originResult, destinationResult);
      setCombinedResult(combined);
    } catch (err) {
      setError(normalizeError(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // 画面にフォーカスが戻った時にリロード
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      fetchData();
    });
    return unsubscribe;
  }, [navigation, fetchData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, [fetchData]);

  const handleTimeChange = async (
    type: 'start' | 'end',
    hour: number,
    minute: number
  ) => {
    const timeStr = `${hour.toString().padStart(2, '0')}:${minute
      .toString()
      .padStart(2, '0')}`;

    const newOutingTime = {
      ...outingTime,
      [type]: timeStr,
    };
    setOutingTime(newOutingTime);

    if (type === 'start') {
      setShowStartPicker(false);
    } else {
      setShowEndPicker(false);
    }

    // 今日の曜日設定を更新
    if (settings && settings.weeklySchedule) {
      const dayOfWeek = new Date().getDay() as DayOfWeek;
      const todaySchedule = settings.weeklySchedule[dayOfWeek];

      const newWeeklySchedule = {
        ...settings.weeklySchedule,
        [dayOfWeek]: {
          ...todaySchedule,
          outingStart: type === 'start' ? timeStr : todaySchedule.outingStart,
          outingEnd: type === 'end' ? timeStr : todaySchedule.outingEnd,
        },
      };

      const newSettings = {
        ...settings,
        weeklySchedule: newWeeklySchedule,
        // 後方互換性のためグローバル設定も更新
        defaultOutingStart:
          type === 'start' ? timeStr : settings.defaultOutingStart,
        defaultOutingEnd: type === 'end' ? timeStr : settings.defaultOutingEnd,
      };
      await saveSettings(newSettings);
      setSettings(newSettings);
      fetchData();
    }
  };

  // 外出予定がない日かどうか
  const isNoOutingDay =
    combinedResult?.overallMessage?.includes('外出予定がありません') ?? false;

  const getBackgroundColor = () => {
    if (!combinedResult) return '#f5f5f5';
    if (isNoOutingDay) return '#9E9E9E'; // グレー
    switch (combinedResult.overallDecision) {
      case 'required':
        return '#4A90D9';
      case 'recommended':
        return '#F5A623';
      case 'not_required':
        return '#7ED321';
    }
  };

  const getIcon = () => {
    if (!combinedResult) return '🌡️';
    if (isNoOutingDay) return '🏠'; // 家のアイコン
    switch (combinedResult.overallDecision) {
      case 'required':
        return '☂️';
      case 'recommended':
        return '🌂';
      case 'not_required':
        return '☀️';
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size={isTablet ? 'large' : 'large'} color="#4A90D9" />
          <Text style={[styles.loadingText, { fontSize: 16 * scale }]}>天気データを取得中...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* ヘッダー */}
        <View style={styles.header}>
          <Text style={[styles.headerTitle, { fontSize: 24 * scale }]}>傘持ってく？</Text>
          <TouchableOpacity
            style={styles.settingsButton}
            onPress={() => navigation.navigate('Settings')}
          >
            <Text style={[styles.settingsIcon, { fontSize: 24 * scale }]}>⚙️</Text>
          </TouchableOpacity>
        </View>

        {/* メインコンテンツ */}
        {error ? (
          <View style={styles.errorContainer}>
            <Text style={[styles.errorIcon, { fontSize: 48 * scale }]}>{getErrorIcon(error.type)}</Text>
            <Text style={[styles.errorText, { fontSize: 16 * scale }]}>{getErrorMessage(error)}</Text>
            <View style={styles.errorActions}>
              <TouchableOpacity style={styles.retryButton} onPress={fetchData}>
                <Text style={[styles.retryButtonText, { fontSize: 16 * scale }]}>再試行</Text>
              </TouchableOpacity>
              {(error.type === 'manual_location' || error.type === 'permission') && (
                <TouchableOpacity
                  style={styles.manualButton}
                  onPress={() => navigation.navigate('Settings')}
                >
                  <Text style={[styles.manualButtonText, { fontSize: 16 * scale }]}>設定で手動選択</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        ) : combinedResult ? (
          <TouchableOpacity
            style={[styles.mainCard, { backgroundColor: getBackgroundColor(), padding: 30 * scale }]}
            onPress={() => setExpanded(!expanded)}
            activeOpacity={0.8}
          >
            <Text style={[styles.cardDate, { fontSize: 16 * scale }]}>
              {(() => {
                const now = new Date();
                const month = now.getMonth() + 1;
                const date = now.getDate();
                const dayOfWeek = now.getDay() as DayOfWeek;
                return `${month}月${date}日（${DAY_NAMES[dayOfWeek]}）`;
              })()}
            </Text>
            <Text style={[styles.mainIcon, { fontSize: 80 * scale }]}>{getIcon()}</Text>
            <Text style={[styles.mainMessage, { fontSize: 24 * scale }]}>{combinedResult.overallMessage}</Text>

            {!expanded && (
              <Text style={[styles.tapHint, { fontSize: 14 * scale }]}>タップで詳細を見る</Text>
            )}

            {expanded && (
              <View style={styles.detailContainer}>
                {/* 出発地の詳細 */}
                {combinedResult.origin && (
                  <View style={styles.locationDetail}>
                    <Text style={[styles.locationHeader, { fontSize: 16 * scale }]}>
                      🏠 {combinedResult.origin.location.name}
                    </Text>
                    {combinedResult.origin.result.hourlyForecasts.map((f, i) => (
                      <View key={i} style={[styles.forecastRow, { paddingVertical: 4 * scale, paddingHorizontal: 10 * scale }]}>
                        <Text style={[styles.forecastTime, { fontSize: 14 * scale }]}>{f.time}</Text>
                        <View style={styles.forecastMetrics}>
                          <Text style={[styles.forecastPop, { fontSize: 14 * scale, width: 50 * scale }]}>{f.pop}%</Text>
                          <Text style={[styles.forecastPrecip, { fontSize: 14 * scale, width: 60 * scale, marginLeft: 12 * scale }]}>{f.precipitation}mm</Text>
                        </View>
                      </View>
                    ))}
                  </View>
                )}

                {/* 目的地の詳細 */}
                {combinedResult.destination && (
                  <View style={styles.locationDetail}>
                    <Text style={[styles.locationHeader, { fontSize: 16 * scale }]}>
                      🏢 {combinedResult.destination.location.name}
                    </Text>
                    {combinedResult.destination.result.hourlyForecasts.map((f, i) => (
                      <View key={i} style={[styles.forecastRow, { paddingVertical: 4 * scale, paddingHorizontal: 10 * scale }]}>
                        <Text style={[styles.forecastTime, { fontSize: 14 * scale }]}>{f.time}</Text>
                        <View style={styles.forecastMetrics}>
                          <Text style={[styles.forecastPop, { fontSize: 14 * scale, width: 50 * scale }]}>{f.pop}%</Text>
                          <Text style={[styles.forecastPrecip, { fontSize: 14 * scale, width: 60 * scale, marginLeft: 12 * scale }]}>{f.precipitation}mm</Text>
                        </View>
                      </View>
                    ))}
                  </View>
                )}

                {!combinedResult.origin && !combinedResult.destination && (
                  <Text style={[styles.noLocationText, { fontSize: 14 * scale }]}>
                    設定から出発地・目的地を登録してください
                  </Text>
                )}
              </View>
            )}
          </TouchableOpacity>
        ) : null}

        {/* 地点サマリー */}
        {combinedResult && (
          <View style={[styles.locationSummary, { padding: 15 * scale }]}>
            <TouchableOpacity
              style={styles.locationSummaryItem}
              onPress={() => navigation.navigate('Settings')}
              activeOpacity={0.7}
            >
              <Text style={[styles.locationSummaryLabel, { fontSize: 12 * scale }]}>🏠 出発地</Text>
              <Text style={[styles.locationSummaryValue, { fontSize: 14 * scale }]}>
                {combinedResult.origin?.location.name || 'GPS（現在地）'}
              </Text>
              {combinedResult.origin && (
                <Text style={[styles.locationSummaryPop, { fontSize: 18 * scale }]}>
                  {combinedResult.origin.result.maxPop}%
                </Text>
              )}
              <Text style={[styles.locationSummaryHint, { fontSize: 10 * scale }]}>タップで変更</Text>
            </TouchableOpacity>
            <View style={styles.locationSummaryDivider} />
            <TouchableOpacity
              style={styles.locationSummaryItem}
              onPress={() => navigation.navigate('Settings')}
              activeOpacity={0.7}
            >
              <Text style={[styles.locationSummaryLabel, { fontSize: 12 * scale }]}>🏢 目的地</Text>
              <Text style={[styles.locationSummaryValue, { fontSize: 14 * scale }]}>
                {combinedResult.destination?.location.name || '未設定'}
              </Text>
              {combinedResult.destination && (
                <Text style={[styles.locationSummaryPop, { fontSize: 18 * scale }]}>
                  {combinedResult.destination.result.maxPop}%
                </Text>
              )}
              <Text style={[styles.locationSummaryHint, { fontSize: 10 * scale }]}>タップで変更</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* 外出時間設定（外出予定がある日のみ表示） */}
        {!isNoOutingDay && (
          <View style={[styles.outingTimeContainer, { padding: 20 * scale }]}>
            <Text style={[styles.outingTimeLabel, { fontSize: 14 * scale }]}>外出予定時間</Text>
            <View style={styles.outingTimeButtons}>
              <TouchableOpacity
                style={[styles.timeButton, { paddingHorizontal: 25 * scale, paddingVertical: 12 * scale }]}
                onPress={() => setShowStartPicker(true)}
              >
                <Text style={[styles.timeButtonText, { fontSize: 20 * scale }]}>{outingTime.start}</Text>
              </TouchableOpacity>
              <Text style={[styles.timeSeparator, { fontSize: 20 * scale }]}>〜</Text>
              <TouchableOpacity
                style={[styles.timeButton, { paddingHorizontal: 25 * scale, paddingVertical: 12 * scale }]}
                onPress={() => setShowEndPicker(true)}
              >
                <Text style={[styles.timeButtonText, { fontSize: 20 * scale }]}>{outingTime.end}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* 外出予定なしの場合の設定誘導 */}
        {isNoOutingDay && (
          <TouchableOpacity
            style={[styles.noOutingSettingsButton, { padding: 16 * scale }]}
            onPress={() => navigation.navigate('Settings')}
          >
            <Text style={[styles.noOutingSettingsText, { fontSize: 16 * scale }]}>
              曜日別の設定を変更する
            </Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* 時間選択モーダル */}
      <TimePickerModal
        visible={showStartPicker}
        title="外出開始時刻"
        initialHour={parseInt(outingTime.start.split(':')[0], 10)}
        initialMinute={parseInt(outingTime.start.split(':')[1], 10)}
        onConfirm={(hour, minute) => handleTimeChange('start', hour, minute)}
        onCancel={() => setShowStartPicker(false)}
      />
      <TimePickerModal
        visible={showEndPicker}
        title="外出終了時刻"
        initialHour={parseInt(outingTime.end.split(':')[0], 10)}
        initialMinute={parseInt(outingTime.end.split(':')[1], 10)}
        onConfirm={(hour, minute) => handleTimeChange('end', hour, minute)}
        onCancel={() => setShowEndPicker(false)}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 30,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 15,
    fontSize: 16,
    color: '#666',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  settingsButton: {
    padding: 8,
  },
  settingsIcon: {
    fontSize: 24,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  errorIcon: {
    fontSize: 48,
    marginBottom: 15,
  },
  errorText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 24,
  },
  errorActions: {
    alignItems: 'center',
  },
  retryButton: {
    backgroundColor: '#4A90D9',
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 10,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  manualButton: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#4A90D9',
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 10,
  },
  manualButtonText: {
    color: '#4A90D9',
    fontSize: 16,
    fontWeight: '600',
  },
  mainCard: {
    borderRadius: 20,
    padding: 30,
    alignItems: 'center',
    marginHorizontal: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  cardDate: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    marginBottom: 10,
  },
  mainIcon: {
    fontSize: 80,
    marginBottom: 20,
  },
  mainMessage: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
  },
  tapHint: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    marginTop: 15,
  },
  detailContainer: {
    width: '100%',
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.3)',
  },
  locationDetail: {
    marginBottom: 20,
  },
  locationHeader: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
  },
  locationPop: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
    marginBottom: 10,
  },
  forecastRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  forecastTime: {
    fontSize: 14,
    color: '#fff',
  },
  forecastMetrics: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  forecastPop: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '600',
    width: 40,
    textAlign: 'right',
  },
  forecastPrecip: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '600',
    marginLeft: 12,
    width: 50,
    textAlign: 'right',
  },
  noLocationText: {
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
    fontSize: 14,
  },
  locationSummary: {
    backgroundColor: '#fff',
    marginHorizontal: 20,
    marginTop: 20,
    padding: 15,
    borderRadius: 15,
    flexDirection: 'row',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  locationSummaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  locationSummaryDivider: {
    width: 1,
    backgroundColor: '#eee',
    marginVertical: 5,
  },
  locationSummaryLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 5,
  },
  locationSummaryValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
  },
  locationSummaryPop: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#4A90D9',
    marginTop: 5,
  },
  locationSummaryHint: {
    fontSize: 10,
    color: '#999',
    marginTop: 4,
  },
  outingTimeContainer: {
    backgroundColor: '#fff',
    marginHorizontal: 20,
    marginTop: 15,
    padding: 20,
    borderRadius: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  outingTimeLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 10,
    textAlign: 'center',
  },
  outingTimeButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  timeButton: {
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 25,
    paddingVertical: 12,
    borderRadius: 10,
  },
  timeButtonText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
  },
  timeSeparator: {
    fontSize: 20,
    color: '#666',
    marginHorizontal: 15,
  },
  noOutingSettingsButton: {
    backgroundColor: '#fff',
    marginHorizontal: 20,
    marginTop: 15,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  noOutingSettingsText: {
    fontSize: 16,
    color: '#4A90D9',
    fontWeight: '500',
  },
});
