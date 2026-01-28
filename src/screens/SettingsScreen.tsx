import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  Linking,
  useWindowDimensions,
} from 'react-native';
import { useNavigation, NavigationProp } from '@react-navigation/native';

type RootStackParamList = {
  Home: undefined;
  Settings: undefined;
  Terms: undefined;
  Disclaimer: undefined;
  License: undefined;
};
import { TimePickerModal } from '../components/TimePickerModal';
import { LocationSearchModal } from '../components/LocationSearchModal';
import {
  loadSettings,
  saveSettings,
  DEFAULT_SETTINGS,
  DAY_NAMES,
  DEFAULT_WEEKLY_SCHEDULE,
} from '../services/storageService';
import {
  requestNotificationPermission,
  syncDailyNotificationWithSettings,
} from '../services/notificationService';
import { Settings, Location, UmbrellaCriteriaLogic, DayOfWeek, DaySchedule } from '../types';

type LocationPickerMode = 'add' | 'origin' | 'destination';

// 閾値の選択肢
const POP_OPTIONS = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
const PRECIP_OPTIONS = [0, 0.5, 1, 2, 3, 5, 10, 20];

const SUPPORT_URL = 'https://your-username.github.io/kasa-motteku/';

export const SettingsScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const { width } = useWindowDimensions();

  // iPad判定（幅768px以上をiPadとみなす）
  const isTablet = width >= 768;
  const scale = isTablet ? 1.5 : 1;

  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [showNotificationPicker, setShowNotificationPicker] = useState(false);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [locationPickerMode, setLocationPickerMode] = useState<LocationPickerMode>('add');
  const [selectedDay, setSelectedDay] = useState<DayOfWeek>(() => new Date().getDay() as DayOfWeek);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  useEffect(() => {
    loadSettings().then(setSettings);
  }, []);

  const handleNotificationToggle = async (enabled: boolean) => {
    if (enabled) {
      const hasPermission = await requestNotificationPermission();
      if (!hasPermission) {
        Alert.alert(
          '通知の許可が必要です',
          '設定アプリから通知を許可してください',
          [
            { text: 'キャンセル', style: 'cancel' },
            {
              text: '設定を開く',
              onPress: () => Linking.openSettings(),
            },
          ]
        );
        return;
      }
    }

    const newSettings = { ...settings, notificationEnabled: enabled };
    setSettings(newSettings);
    await saveSettings(newSettings);
    await syncDailyNotificationWithSettings();
  };

  const handleNotificationTimeChange = async (hour: number, minute: number) => {
    const timeStr = `${hour.toString().padStart(2, '0')}:${minute
      .toString()
      .padStart(2, '0')}`;

    const newSettings = { ...settings, notificationTime: timeStr };
    setSettings(newSettings);
    await saveSettings(newSettings);
    setShowNotificationPicker(false);

    await syncDailyNotificationWithSettings();
  };

  const openLocationPicker = (mode: LocationPickerMode) => {
    setLocationPickerMode(mode);
    setShowLocationPicker(true);
  };

  const handleSelectLocation = async (locationData: {
    name: string;
    areaCode: string;
    latitude: number;
    longitude: number;
    detailedAddress: string;
  }) => {
    // 新しい Location オブジェクトを作成
    const newLocation: Location = {
      id: Date.now().toString(),
      name: locationData.name,
      areaCode: locationData.areaCode,
      isGPS: false,
      latitude: locationData.latitude,
      longitude: locationData.longitude,
    };

    if (locationPickerMode === 'add') {
      // 新規追加
      const newSettings = {
        ...settings,
        locations: [...settings.locations, newLocation],
      };
      setSettings(newSettings);
      await saveSettings(newSettings);
    } else if (locationPickerMode === 'origin') {
      // 出発地として設定（曜日設定に反映）
      const currentSchedule = settings.weeklySchedule?.[selectedDay] ?? DEFAULT_WEEKLY_SCHEDULE[selectedDay];
      const newWeeklySchedule = {
        ...settings.weeklySchedule ?? DEFAULT_WEEKLY_SCHEDULE,
        [selectedDay]: { ...currentSchedule, originLocationId: newLocation.id },
      };

      const newSettings = {
        ...settings,
        locations: [...settings.locations, newLocation],
        weeklySchedule: newWeeklySchedule,
        originLocationId: newLocation.id, // 後方互換性
      };
      setSettings(newSettings);
      await saveSettings(newSettings);
    } else if (locationPickerMode === 'destination') {
      // 目的地として設定（曜日設定に反映）
      const currentSchedule = settings.weeklySchedule?.[selectedDay] ?? DEFAULT_WEEKLY_SCHEDULE[selectedDay];
      const newWeeklySchedule = {
        ...settings.weeklySchedule ?? DEFAULT_WEEKLY_SCHEDULE,
        [selectedDay]: { ...currentSchedule, destinationLocationId: newLocation.id },
      };

      const newSettings = {
        ...settings,
        locations: [...settings.locations, newLocation],
        weeklySchedule: newWeeklySchedule,
        destinationLocationId: newLocation.id, // 後方互換性
      };
      setSettings(newSettings);
      await saveSettings(newSettings);
    }

    setShowLocationPicker(false);
  };

  const handleSelectExistingLocation = async (
    locationId: string | null,
    type: 'origin' | 'destination'
  ) => {
    if (type === 'origin') {
      const newSettings = { ...settings, originLocationId: locationId };
      setSettings(newSettings);
      await saveSettings(newSettings);
    } else {
      const newSettings = { ...settings, destinationLocationId: locationId };
      setSettings(newSettings);
      await saveSettings(newSettings);
    }
  };

  const handleRemoveLocation = async (locationId: string) => {
    Alert.alert('地点を削除', 'この地点を削除しますか？', [
      { text: 'キャンセル', style: 'cancel' },
      {
        text: '削除',
        style: 'destructive',
        onPress: async () => {
          // 曜日設定からも該当地点を削除
          const newWeeklySchedule = { ...settings.weeklySchedule ?? DEFAULT_WEEKLY_SCHEDULE };
          ([0, 1, 2, 3, 4, 5, 6] as DayOfWeek[]).forEach(day => {
            const schedule = newWeeklySchedule[day];
            if (schedule.originLocationId === locationId) {
              newWeeklySchedule[day] = { ...schedule, originLocationId: null };
            }
            if (schedule.destinationLocationId === locationId) {
              newWeeklySchedule[day] = { ...schedule, destinationLocationId: null };
            }
          });

          const newSettings = {
            ...settings,
            locations: settings.locations.filter((loc) => loc.id !== locationId),
            weeklySchedule: newWeeklySchedule,
            originLocationId:
              settings.originLocationId === locationId ? null : settings.originLocationId,
            destinationLocationId:
              settings.destinationLocationId === locationId
                ? null
                : settings.destinationLocationId,
          };
          setSettings(newSettings);
          await saveSettings(newSettings);
        },
      },
    ]);
  };

  // 傘判断基準の更新
  const handlePopThresholdChange = async (value: number) => {
    const newSettings = {
      ...settings,
      umbrellaCriteria: { ...settings.umbrellaCriteria, popThreshold: value },
    };
    setSettings(newSettings);
    await saveSettings(newSettings);
  };

  const handlePrecipitationThresholdChange = async (value: number) => {
    const newSettings = {
      ...settings,
      umbrellaCriteria: { ...settings.umbrellaCriteria, precipitationThreshold: value },
    };
    setSettings(newSettings);
    await saveSettings(newSettings);
  };

  const handleLogicChange = async (logic: UmbrellaCriteriaLogic) => {
    const newSettings = {
      ...settings,
      umbrellaCriteria: { ...settings.umbrellaCriteria, logic },
    };
    setSettings(newSettings);
    await saveSettings(newSettings);
  };

  // 現在選択中の曜日の設定を取得
  const getSelectedDaySchedule = (): DaySchedule => {
    return settings.weeklySchedule?.[selectedDay] ?? DEFAULT_WEEKLY_SCHEDULE[selectedDay];
  };

  // 曜日設定を更新
  const updateDaySchedule = async (schedule: DaySchedule) => {
    const newWeeklySchedule = {
      ...settings.weeklySchedule ?? DEFAULT_WEEKLY_SCHEDULE,
      [selectedDay]: schedule,
    };

    const newSettings = {
      ...settings,
      weeklySchedule: newWeeklySchedule,
    };

    setSettings(newSettings);
    await saveSettings(newSettings);
  };

  // 外出予定の有無を切り替え
  const handleDayEnabledToggle = async (enabled: boolean) => {
    const schedule = getSelectedDaySchedule();
    await updateDaySchedule({ ...schedule, enabled });
  };

  // 曜日設定の出発地を変更
  const handleDayOriginChange = async (locationId: string | null) => {
    const schedule = getSelectedDaySchedule();
    await updateDaySchedule({ ...schedule, originLocationId: locationId });
  };

  // 曜日設定の目的地を変更
  const handleDayDestinationChange = async (locationId: string | null) => {
    const schedule = getSelectedDaySchedule();
    await updateDaySchedule({ ...schedule, destinationLocationId: locationId });
  };

  // 曜日設定の外出時間を変更
  const handleDayTimeChange = async (type: 'start' | 'end', hour: number, minute: number) => {
    const timeStr = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
    const schedule = getSelectedDaySchedule();

    await updateDaySchedule({
      ...schedule,
      outingStart: type === 'start' ? timeStr : schedule.outingStart,
      outingEnd: type === 'end' ? timeStr : schedule.outingEnd,
    });

    if (type === 'start') {
      setShowStartPicker(false);
    } else {
      setShowEndPicker(false);
    }
  };

  // 平日に同じ設定を適用
  const applyToWeekdays = async () => {
    const currentSchedule = getSelectedDaySchedule();

    Alert.alert(
      '平日に適用',
      `${DAY_NAMES[selectedDay]}曜日の設定を月〜金に適用しますか？`,
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: '適用',
          onPress: async () => {
            const newWeeklySchedule = {
              ...settings.weeklySchedule ?? DEFAULT_WEEKLY_SCHEDULE,
            };
            ([1, 2, 3, 4, 5] as DayOfWeek[]).forEach(day => {
              newWeeklySchedule[day] = { ...currentSchedule };
            });

            const newSettings = { ...settings, weeklySchedule: newWeeklySchedule };
            setSettings(newSettings);
            await saveSettings(newSettings);
            Alert.alert('完了', '月〜金に同じ設定を適用しました');
          },
        },
      ]
    );
  };

  const daySchedule = getSelectedDaySchedule();

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView>
        {/* 曜日別設定 */}
        <View style={[styles.section, { padding: 15 * scale, marginHorizontal: 15 * scale }]}>
          <Text style={[styles.sectionTitle, { fontSize: 14 * scale }]}>曜日別設定</Text>

          {/* 曜日タブ */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.dayTabsContainer}
          >
            {([0, 1, 2, 3, 4, 5, 6] as DayOfWeek[]).map((day) => {
              const schedule = settings.weeklySchedule?.[day] ?? DEFAULT_WEEKLY_SCHEDULE[day];
              const isSelected = selectedDay === day;
              const isEnabled = schedule.enabled;

              return (
                <TouchableOpacity
                  key={day}
                  style={[
                    styles.dayTab,
                    { paddingVertical: 10 * scale, paddingHorizontal: 16 * scale, minWidth: 44 * scale },
                    isSelected && styles.dayTabSelected,
                    !isEnabled && styles.dayTabDisabled,
                  ]}
                  onPress={() => setSelectedDay(day)}
                >
                  <Text
                    style={[
                      styles.dayTabText,
                      { fontSize: 14 * scale },
                      isSelected && styles.dayTabTextSelected,
                      !isEnabled && styles.dayTabTextDisabled,
                    ]}
                  >
                    {DAY_NAMES[day]}
                  </Text>
                  {isEnabled && <View style={[styles.dayTabDot, { width: 6 * scale, height: 6 * scale }]} />}
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* 選択中の曜日の設定パネル */}
          <View style={styles.daySettingsPanel}>
            {/* 外出予定の有無 */}
            <View style={[styles.settingRow, { paddingVertical: 12 * scale }]}>
              <View>
                <Text style={[styles.settingLabel, { fontSize: 16 * scale }]}>外出予定</Text>
                <Text style={[styles.settingDescription, { fontSize: 12 * scale }]}>
                  {DAY_NAMES[selectedDay]}曜日に外出するか
                </Text>
              </View>
              <Switch
                value={daySchedule.enabled}
                onValueChange={handleDayEnabledToggle}
                trackColor={{ false: '#ddd', true: '#4A90D9' }}
                style={{ transform: [{ scale: scale }] }}
              />
            </View>

            {daySchedule.enabled && (
              <>
                {/* 出発地選択 */}
                <View style={styles.locationSection}>
                  <Text style={[styles.locationTitle, { fontSize: 16 * scale }]}>🏠 出発地</Text>
                  <TouchableOpacity
                    style={[
                      styles.locationSelectItem,
                      { padding: 12 * scale },
                      !daySchedule.originLocationId && styles.locationSelectItemSelected,
                    ]}
                    onPress={() => handleDayOriginChange(null)}
                  >
                    <Text style={[styles.locationSelectIcon, { fontSize: 18 * scale }]}>📍</Text>
                    <Text style={[styles.locationSelectText, { fontSize: 15 * scale }]}>GPS（現在地）</Text>
                    {!daySchedule.originLocationId && <Text style={[styles.checkmark, { fontSize: 18 * scale }]}>✓</Text>}
                  </TouchableOpacity>

                  {settings.locations.map((location) => (
                    <TouchableOpacity
                      key={`origin-${location.id}`}
                      style={[
                        styles.locationSelectItem,
                        { padding: 12 * scale },
                        daySchedule.originLocationId === location.id &&
                          styles.locationSelectItemSelected,
                      ]}
                      onPress={() => handleDayOriginChange(location.id)}
                    >
                      <Text style={[styles.locationSelectIcon, { fontSize: 18 * scale }]}>🏠</Text>
                      <Text style={[styles.locationSelectText, { fontSize: 15 * scale }]}>{location.name}</Text>
                      {daySchedule.originLocationId === location.id && (
                        <Text style={[styles.checkmark, { fontSize: 18 * scale }]}>✓</Text>
                      )}
                    </TouchableOpacity>
                  ))}

                  <TouchableOpacity
                    style={[styles.addLocationButton, { padding: 12 * scale }]}
                    onPress={() => openLocationPicker('origin')}
                  >
                    <Text style={[styles.addLocationButtonText, { fontSize: 14 * scale }]}>＋ 新しい地点を追加</Text>
                  </TouchableOpacity>
                </View>

                {/* 目的地選択 */}
                <View style={styles.locationSection}>
                  <Text style={[styles.locationTitle, { fontSize: 16 * scale }]}>🏢 目的地</Text>
                  <TouchableOpacity
                    style={[
                      styles.locationSelectItem,
                      { padding: 12 * scale },
                      !daySchedule.destinationLocationId && styles.locationSelectItemSelected,
                    ]}
                    onPress={() => handleDayDestinationChange(null)}
                  >
                    <Text style={[styles.locationSelectIcon, { fontSize: 18 * scale }]}>❌</Text>
                    <Text style={[styles.locationSelectText, { fontSize: 15 * scale }]}>設定しない</Text>
                    {!daySchedule.destinationLocationId && <Text style={[styles.checkmark, { fontSize: 18 * scale }]}>✓</Text>}
                  </TouchableOpacity>

                  {settings.locations.map((location) => (
                    <TouchableOpacity
                      key={`dest-${location.id}`}
                      style={[
                        styles.locationSelectItem,
                        { padding: 12 * scale },
                        daySchedule.destinationLocationId === location.id &&
                          styles.locationSelectItemSelected,
                      ]}
                      onPress={() => handleDayDestinationChange(location.id)}
                    >
                      <Text style={[styles.locationSelectIcon, { fontSize: 18 * scale }]}>🏢</Text>
                      <Text style={[styles.locationSelectText, { fontSize: 15 * scale }]}>{location.name}</Text>
                      {daySchedule.destinationLocationId === location.id && (
                        <Text style={[styles.checkmark, { fontSize: 18 * scale }]}>✓</Text>
                      )}
                    </TouchableOpacity>
                  ))}

                  <TouchableOpacity
                    style={[styles.addLocationButton, { padding: 12 * scale }]}
                    onPress={() => openLocationPicker('destination')}
                  >
                    <Text style={[styles.addLocationButtonText, { fontSize: 14 * scale }]}>＋ 新しい地点を追加</Text>
                  </TouchableOpacity>
                </View>

                {/* 外出時間 */}
                <View style={styles.outingTimeSection}>
                  <Text style={[styles.locationTitle, { fontSize: 16 * scale }]}>🕐 外出時間</Text>
                  <View style={styles.outingTimeButtons}>
                    <TouchableOpacity
                      style={[styles.timeButton, { paddingHorizontal: 25 * scale, paddingVertical: 12 * scale }]}
                      onPress={() => setShowStartPicker(true)}
                    >
                      <Text style={[styles.timeButtonText, { fontSize: 18 * scale }]}>{daySchedule.outingStart}</Text>
                    </TouchableOpacity>
                    <Text style={[styles.timeSeparator, { fontSize: 18 * scale }]}>〜</Text>
                    <TouchableOpacity
                      style={[styles.timeButton, { paddingHorizontal: 25 * scale, paddingVertical: 12 * scale }]}
                      onPress={() => setShowEndPicker(true)}
                    >
                      <Text style={[styles.timeButtonText, { fontSize: 18 * scale }]}>{daySchedule.outingEnd}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </>
            )}

            {/* 平日に適用ボタン */}
            <TouchableOpacity style={[styles.applyWeekdaysButton, { padding: 14 * scale }]} onPress={applyToWeekdays}>
              <Text style={[styles.applyWeekdaysButtonText, { fontSize: 14 * scale }]}>平日（月〜金）に同じ設定を適用</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 登録済み地点の管理 */}
        {settings.locations.length > 0 && (
          <View style={[styles.section, { padding: 15 * scale, marginHorizontal: 15 * scale }]}>
            <Text style={[styles.sectionTitle, { fontSize: 14 * scale }]}>登録済み地点</Text>
            {settings.locations.map((location) => (
              <TouchableOpacity
                key={location.id}
                style={[styles.registeredLocation, { padding: 15 * scale }]}
                onLongPress={() => handleRemoveLocation(location.id)}
              >
                <Text style={[styles.registeredLocationName, { fontSize: 16 * scale }]}>{location.name}</Text>
                <Text style={[styles.registeredLocationHint, { fontSize: 12 * scale }]}>長押しで削除</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* 通知設定 */}
        <View style={[styles.section, { padding: 15 * scale, marginHorizontal: 15 * scale }]}>
          <Text style={[styles.sectionTitle, { fontSize: 14 * scale }]}>通知設定</Text>
          <View style={[styles.settingRow, { paddingVertical: 12 * scale }]}>
            <View>
              <Text style={[styles.settingLabel, { fontSize: 16 * scale }]}>毎朝の通知</Text>
              <Text style={[styles.settingDescription, { fontSize: 12 * scale }]}>
                傘の要否を毎朝通知します
              </Text>
            </View>
            <Switch
              value={settings.notificationEnabled}
              onValueChange={handleNotificationToggle}
              trackColor={{ false: '#ddd', true: '#4A90D9' }}
              style={{ transform: [{ scale: scale }] }}
            />
          </View>

          {settings.notificationEnabled && (
            <TouchableOpacity
              style={[styles.settingRow, { paddingVertical: 12 * scale }]}
              onPress={() => setShowNotificationPicker(true)}
            >
              <View>
                <Text style={[styles.settingLabel, { fontSize: 16 * scale }]}>通知時刻</Text>
                <Text style={[styles.settingDescription, { fontSize: 12 * scale }]}>
                  毎日この時刻に通知します
                </Text>
              </View>
              <Text style={[styles.settingValue, { fontSize: 16 * scale }]}>{settings.notificationTime}</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* 傘判断基準設定 */}
        <View style={[styles.section, { padding: 15 * scale, marginHorizontal: 15 * scale }]}>
          <Text style={[styles.sectionTitle, { fontSize: 14 * scale }]}>傘判断基準</Text>

          {/* 降水確率の閾値 */}
          <View style={styles.criteriaSection}>
            <Text style={[styles.criteriaLabel, { fontSize: 15 * scale }]}>降水確率</Text>
            <View style={[styles.criteriaOptions, { gap: 8 * scale }]}>
              {POP_OPTIONS.map((value) => (
                <TouchableOpacity
                  key={`pop-${value}`}
                  style={[
                    styles.criteriaOption,
                    { paddingVertical: 8 * scale, paddingHorizontal: 16 * scale },
                    settings.umbrellaCriteria.popThreshold === value &&
                      styles.criteriaOptionSelected,
                  ]}
                  onPress={() => handlePopThresholdChange(value)}
                >
                  <Text
                    style={[
                      styles.criteriaOptionText,
                      { fontSize: 14 * scale },
                      settings.umbrellaCriteria.popThreshold === value &&
                        styles.criteriaOptionTextSelected,
                    ]}
                  >
                    {value}%
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={[styles.criteriaHint, { fontSize: 12 * scale }]}>以上で傘必要</Text>
          </View>

          {/* 降水量の閾値 */}
          <View style={styles.criteriaSection}>
            <Text style={[styles.criteriaLabel, { fontSize: 15 * scale }]}>降水量</Text>
            <View style={[styles.criteriaOptions, { gap: 8 * scale }]}>
              {PRECIP_OPTIONS.map((value) => (
                <TouchableOpacity
                  key={`precip-${value}`}
                  style={[
                    styles.criteriaOption,
                    { paddingVertical: 8 * scale, paddingHorizontal: 16 * scale },
                    settings.umbrellaCriteria.precipitationThreshold === value &&
                      styles.criteriaOptionSelected,
                  ]}
                  onPress={() => handlePrecipitationThresholdChange(value)}
                >
                  <Text
                    style={[
                      styles.criteriaOptionText,
                      { fontSize: 14 * scale },
                      settings.umbrellaCriteria.precipitationThreshold === value &&
                        styles.criteriaOptionTextSelected,
                    ]}
                  >
                    {value}mm
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={[styles.criteriaHint, { fontSize: 12 * scale }]}>以上で傘必要</Text>
          </View>

          {/* AND/OR 条件 */}
          <View style={styles.criteriaSection}>
            <Text style={[styles.criteriaLabel, { fontSize: 15 * scale }]}>条件の組み合わせ</Text>
            <View style={[styles.logicOptions, { gap: 10 * scale }]}>
              <TouchableOpacity
                style={[
                  styles.logicOption,
                  { padding: 12 * scale },
                  settings.umbrellaCriteria.logic === 'or' && styles.logicOptionSelected,
                ]}
                onPress={() => handleLogicChange('or')}
              >
                <Text
                  style={[
                    styles.logicOptionText,
                    { fontSize: 15 * scale },
                    settings.umbrellaCriteria.logic === 'or' &&
                      styles.logicOptionTextSelected,
                  ]}
                >
                  どちらか (OR)
                </Text>
                <Text style={[styles.logicOptionHint, { fontSize: 12 * scale }]}>
                  確率または降水量のどちらかが閾値以上
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.logicOption,
                  { padding: 12 * scale },
                  settings.umbrellaCriteria.logic === 'and' && styles.logicOptionSelected,
                ]}
                onPress={() => handleLogicChange('and')}
              >
                <Text
                  style={[
                    styles.logicOptionText,
                    { fontSize: 15 * scale },
                    settings.umbrellaCriteria.logic === 'and' &&
                      styles.logicOptionTextSelected,
                  ]}
                >
                  両方 (AND)
                </Text>
                <Text style={[styles.logicOptionHint, { fontSize: 12 * scale }]}>
                  確率と降水量の両方が閾値以上
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* 法的情報 */}
        <View style={[styles.section, { padding: 15 * scale, marginHorizontal: 15 * scale }]}>
          <Text style={[styles.sectionTitle, { fontSize: 14 * scale }]}>法的情報</Text>
          <TouchableOpacity
            style={[styles.legalItem, { paddingVertical: 14 * scale }]}
            onPress={() => navigation.navigate('Terms')}
          >
            <Text style={[styles.legalItemText, { fontSize: 16 * scale }]}>利用規約</Text>
            <Text style={[styles.legalItemArrow, { fontSize: 20 * scale }]}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.legalItem, { paddingVertical: 14 * scale }]}
            onPress={() => navigation.navigate('Disclaimer')}
          >
            <Text style={[styles.legalItemText, { fontSize: 16 * scale }]}>免責事項</Text>
            <Text style={[styles.legalItemArrow, { fontSize: 20 * scale }]}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.legalItem, { paddingVertical: 14 * scale }]}
            onPress={() => navigation.navigate('License')}
          >
            <Text style={[styles.legalItemText, { fontSize: 16 * scale }]}>ライセンス情報</Text>
            <Text style={[styles.legalItemArrow, { fontSize: 20 * scale }]}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.legalItem, { paddingVertical: 14 * scale }]}
            onPress={() => Linking.openURL(SUPPORT_URL)}
          >
            <Text style={[styles.legalItemText, { fontSize: 16 * scale }]}>サポートサイト</Text>
            <Text style={[styles.legalItemArrow, { fontSize: 20 * scale }]}>↗</Text>
          </TouchableOpacity>
        </View>

        {/* バージョン情報 */}
        <View style={[styles.section, { padding: 15 * scale, marginHorizontal: 15 * scale }]}>
          <Text style={[styles.versionText, { fontSize: 14 * scale }]}>傘持ってく？ v1.1.0</Text>
        </View>
      </ScrollView>

      {/* 通知時刻選択モーダル */}
      <TimePickerModal
        visible={showNotificationPicker}
        title="通知時刻"
        initialHour={parseInt(settings.notificationTime.split(':')[0], 10)}
        initialMinute={parseInt(settings.notificationTime.split(':')[1], 10)}
        onConfirm={handleNotificationTimeChange}
        onCancel={() => setShowNotificationPicker(false)}
      />

      {/* 地点検索モーダル */}
      <LocationSearchModal
        visible={showLocationPicker}
        title={
          locationPickerMode === 'add'
            ? '地点を追加'
            : locationPickerMode === 'origin'
            ? '出発地を検索'
            : '目的地を検索'
        }
        onSelectLocation={handleSelectLocation}
        onCancel={() => setShowLocationPicker(false)}
      />

      {/* 曜日設定用時間ピッカー */}
      <TimePickerModal
        visible={showStartPicker}
        title="外出開始時刻"
        initialHour={parseInt(daySchedule.outingStart.split(':')[0], 10)}
        initialMinute={parseInt(daySchedule.outingStart.split(':')[1], 10)}
        onConfirm={(hour, minute) => handleDayTimeChange('start', hour, minute)}
        onCancel={() => setShowStartPicker(false)}
      />
      <TimePickerModal
        visible={showEndPicker}
        title="外出終了時刻"
        initialHour={parseInt(daySchedule.outingEnd.split(':')[0], 10)}
        initialMinute={parseInt(daySchedule.outingEnd.split(':')[1], 10)}
        onConfirm={(hour, minute) => handleDayTimeChange('end', hour, minute)}
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
  section: {
    backgroundColor: '#fff',
    marginTop: 20,
    marginHorizontal: 15,
    borderRadius: 12,
    padding: 15,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 15,
    textTransform: 'uppercase',
  },
  locationSection: {
    marginBottom: 20,
  },
  locationTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 10,
  },
  locationSelectItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    backgroundColor: '#f8f8f8',
    marginBottom: 8,
  },
  locationSelectItemSelected: {
    backgroundColor: '#e8f4fd',
    borderWidth: 1,
    borderColor: '#4A90D9',
  },
  locationSelectIcon: {
    fontSize: 18,
    marginRight: 10,
  },
  locationSelectText: {
    flex: 1,
    fontSize: 15,
    color: '#333',
  },
  checkmark: {
    fontSize: 18,
    color: '#4A90D9',
    fontWeight: 'bold',
  },
  addLocationButton: {
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#4A90D9',
    borderRadius: 10,
    marginTop: 5,
  },
  addLocationButtonText: {
    color: '#4A90D9',
    fontSize: 14,
    fontWeight: '500',
  },
  registeredLocation: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  registeredLocationName: {
    fontSize: 16,
    color: '#333',
  },
  registeredLocationHint: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  settingLabel: {
    fontSize: 16,
    color: '#333',
  },
  settingDescription: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  settingValue: {
    fontSize: 16,
    color: '#4A90D9',
    fontWeight: '600',
  },
  legalItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  legalItemText: {
    fontSize: 16,
    color: '#333',
  },
  legalItemArrow: {
    fontSize: 20,
    color: '#999',
  },
  versionText: {
    textAlign: 'center',
    color: '#999',
    fontSize: 14,
  },
  criteriaSection: {
    marginBottom: 20,
  },
  criteriaLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
    marginBottom: 10,
  },
  criteriaOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  criteriaOption: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  criteriaOptionSelected: {
    backgroundColor: '#e8f4fd',
    borderColor: '#4A90D9',
  },
  criteriaOptionText: {
    fontSize: 14,
    color: '#666',
  },
  criteriaOptionTextSelected: {
    color: '#4A90D9',
    fontWeight: '600',
  },
  criteriaHint: {
    fontSize: 12,
    color: '#999',
    marginTop: 8,
  },
  logicOptions: {
    gap: 10,
  },
  logicOption: {
    padding: 12,
    borderRadius: 10,
    backgroundColor: '#f8f8f8',
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  logicOptionSelected: {
    backgroundColor: '#e8f4fd',
    borderColor: '#4A90D9',
  },
  logicOptionText: {
    fontSize: 15,
    color: '#333',
    fontWeight: '500',
  },
  logicOptionTextSelected: {
    color: '#4A90D9',
  },
  logicOptionHint: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  dayTabsContainer: {
    marginBottom: 15,
  },
  dayTab: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginRight: 8,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    minWidth: 44,
  },
  dayTabSelected: {
    backgroundColor: '#4A90D9',
  },
  dayTabDisabled: {
    backgroundColor: '#f8f8f8',
  },
  dayTabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  dayTabTextSelected: {
    color: '#fff',
  },
  dayTabTextDisabled: {
    color: '#bbb',
  },
  dayTabDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#7ED321',
    marginTop: 4,
  },
  daySettingsPanel: {
    paddingTop: 10,
  },
  outingTimeSection: {
    marginBottom: 20,
  },
  outingTimeButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  timeButton: {
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 25,
    paddingVertical: 12,
    borderRadius: 10,
  },
  timeButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  timeSeparator: {
    fontSize: 18,
    color: '#666',
    marginHorizontal: 15,
  },
  applyWeekdaysButton: {
    backgroundColor: '#f5f5f5',
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  applyWeekdaysButtonText: {
    fontSize: 14,
    color: '#4A90D9',
    fontWeight: '500',
  },
});
