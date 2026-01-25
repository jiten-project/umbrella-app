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
} from '../services/storageService';
import {
  requestNotificationPermission,
  syncDailyNotificationWithSettings,
} from '../services/notificationService';
import { Settings, Location, UmbrellaCriteriaLogic } from '../types';

type LocationPickerMode = 'add' | 'origin' | 'destination';

// 閾値の選択肢
const POP_OPTIONS = [30, 40, 50, 60, 70];
const PRECIP_OPTIONS = [0.5, 1, 2, 3, 5];

const SUPPORT_URL = 'https://your-username.github.io/umbrella-app/';

export const SettingsScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [showNotificationPicker, setShowNotificationPicker] = useState(false);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [locationPickerMode, setLocationPickerMode] = useState<LocationPickerMode>('add');

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
      // 出発地として設定
      const newSettings = {
        ...settings,
        locations: [...settings.locations, newLocation],
        originLocationId: newLocation.id,
      };
      setSettings(newSettings);
      await saveSettings(newSettings);
    } else if (locationPickerMode === 'destination') {
      // 目的地として設定
      const newSettings = {
        ...settings,
        locations: [...settings.locations, newLocation],
        destinationLocationId: newLocation.id,
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
          const newSettings = {
            ...settings,
            locations: settings.locations.filter((loc) => loc.id !== locationId),
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

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView>
        {/* 出発地・目的地設定 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>地点設定</Text>

          {/* 出発地 */}
          <View style={styles.locationSection}>
            <Text style={styles.locationTitle}>🏠 出発地</Text>
            <TouchableOpacity
              style={[
                styles.locationSelectItem,
                !settings.originLocationId && styles.locationSelectItemSelected,
              ]}
              onPress={() => handleSelectExistingLocation(null, 'origin')}
            >
              <Text style={styles.locationSelectIcon}>📍</Text>
              <Text style={styles.locationSelectText}>GPS（現在地）</Text>
              {!settings.originLocationId && <Text style={styles.checkmark}>✓</Text>}
            </TouchableOpacity>

            {settings.locations.map((location) => (
              <TouchableOpacity
                key={`origin-${location.id}`}
                style={[
                  styles.locationSelectItem,
                  settings.originLocationId === location.id &&
                    styles.locationSelectItemSelected,
                ]}
                onPress={() => handleSelectExistingLocation(location.id, 'origin')}
              >
                <Text style={styles.locationSelectIcon}>🏠</Text>
                <Text style={styles.locationSelectText}>{location.name}</Text>
                {settings.originLocationId === location.id && (
                  <Text style={styles.checkmark}>✓</Text>
                )}
              </TouchableOpacity>
            ))}

            <TouchableOpacity
              style={styles.addLocationButton}
              onPress={() => openLocationPicker('origin')}
            >
              <Text style={styles.addLocationButtonText}>＋ 新しい地点を追加</Text>
            </TouchableOpacity>
          </View>

          {/* 目的地 */}
          <View style={styles.locationSection}>
            <Text style={styles.locationTitle}>🏢 目的地</Text>
            <TouchableOpacity
              style={[
                styles.locationSelectItem,
                !settings.destinationLocationId && styles.locationSelectItemSelected,
              ]}
              onPress={() => handleSelectExistingLocation(null, 'destination')}
            >
              <Text style={styles.locationSelectIcon}>❌</Text>
              <Text style={styles.locationSelectText}>設定しない</Text>
              {!settings.destinationLocationId && <Text style={styles.checkmark}>✓</Text>}
            </TouchableOpacity>

            {settings.locations.map((location) => (
              <TouchableOpacity
                key={`dest-${location.id}`}
                style={[
                  styles.locationSelectItem,
                  settings.destinationLocationId === location.id &&
                    styles.locationSelectItemSelected,
                ]}
                onPress={() => handleSelectExistingLocation(location.id, 'destination')}
              >
                <Text style={styles.locationSelectIcon}>🏢</Text>
                <Text style={styles.locationSelectText}>{location.name}</Text>
                {settings.destinationLocationId === location.id && (
                  <Text style={styles.checkmark}>✓</Text>
                )}
              </TouchableOpacity>
            ))}

            <TouchableOpacity
              style={styles.addLocationButton}
              onPress={() => openLocationPicker('destination')}
            >
              <Text style={styles.addLocationButtonText}>＋ 新しい地点を追加</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 登録済み地点の管理 */}
        {settings.locations.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>登録済み地点</Text>
            {settings.locations.map((location) => (
              <TouchableOpacity
                key={location.id}
                style={styles.registeredLocation}
                onLongPress={() => handleRemoveLocation(location.id)}
              >
                <Text style={styles.registeredLocationName}>{location.name}</Text>
                <Text style={styles.registeredLocationHint}>長押しで削除</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* 通知設定 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>通知設定</Text>
          <View style={styles.settingRow}>
            <View>
              <Text style={styles.settingLabel}>毎朝の通知</Text>
              <Text style={styles.settingDescription}>
                傘の要否を毎朝通知します
              </Text>
            </View>
            <Switch
              value={settings.notificationEnabled}
              onValueChange={handleNotificationToggle}
              trackColor={{ false: '#ddd', true: '#4A90D9' }}
            />
          </View>

          {settings.notificationEnabled && (
            <TouchableOpacity
              style={styles.settingRow}
              onPress={() => setShowNotificationPicker(true)}
            >
              <View>
                <Text style={styles.settingLabel}>通知時刻</Text>
                <Text style={styles.settingDescription}>
                  毎日この時刻に通知します
                </Text>
              </View>
              <Text style={styles.settingValue}>{settings.notificationTime}</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* 傘判断基準設定 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>傘判断基準</Text>

          {/* 降水確率の閾値 */}
          <View style={styles.criteriaSection}>
            <Text style={styles.criteriaLabel}>降水確率</Text>
            <View style={styles.criteriaOptions}>
              {POP_OPTIONS.map((value) => (
                <TouchableOpacity
                  key={`pop-${value}`}
                  style={[
                    styles.criteriaOption,
                    settings.umbrellaCriteria.popThreshold === value &&
                      styles.criteriaOptionSelected,
                  ]}
                  onPress={() => handlePopThresholdChange(value)}
                >
                  <Text
                    style={[
                      styles.criteriaOptionText,
                      settings.umbrellaCriteria.popThreshold === value &&
                        styles.criteriaOptionTextSelected,
                    ]}
                  >
                    {value}%
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.criteriaHint}>以上で傘必要</Text>
          </View>

          {/* 降水量の閾値 */}
          <View style={styles.criteriaSection}>
            <Text style={styles.criteriaLabel}>降水量</Text>
            <View style={styles.criteriaOptions}>
              {PRECIP_OPTIONS.map((value) => (
                <TouchableOpacity
                  key={`precip-${value}`}
                  style={[
                    styles.criteriaOption,
                    settings.umbrellaCriteria.precipitationThreshold === value &&
                      styles.criteriaOptionSelected,
                  ]}
                  onPress={() => handlePrecipitationThresholdChange(value)}
                >
                  <Text
                    style={[
                      styles.criteriaOptionText,
                      settings.umbrellaCriteria.precipitationThreshold === value &&
                        styles.criteriaOptionTextSelected,
                    ]}
                  >
                    {value}mm
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.criteriaHint}>以上で傘必要</Text>
          </View>

          {/* AND/OR 条件 */}
          <View style={styles.criteriaSection}>
            <Text style={styles.criteriaLabel}>条件の組み合わせ</Text>
            <View style={styles.logicOptions}>
              <TouchableOpacity
                style={[
                  styles.logicOption,
                  settings.umbrellaCriteria.logic === 'or' && styles.logicOptionSelected,
                ]}
                onPress={() => handleLogicChange('or')}
              >
                <Text
                  style={[
                    styles.logicOptionText,
                    settings.umbrellaCriteria.logic === 'or' &&
                      styles.logicOptionTextSelected,
                  ]}
                >
                  どちらか (OR)
                </Text>
                <Text style={styles.logicOptionHint}>
                  確率または降水量のどちらかが閾値以上
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.logicOption,
                  settings.umbrellaCriteria.logic === 'and' && styles.logicOptionSelected,
                ]}
                onPress={() => handleLogicChange('and')}
              >
                <Text
                  style={[
                    styles.logicOptionText,
                    settings.umbrellaCriteria.logic === 'and' &&
                      styles.logicOptionTextSelected,
                  ]}
                >
                  両方 (AND)
                </Text>
                <Text style={styles.logicOptionHint}>
                  確率と降水量の両方が閾値以上
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* 法的情報 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>法的情報</Text>
          <TouchableOpacity
            style={styles.legalItem}
            onPress={() => navigation.navigate('Terms')}
          >
            <Text style={styles.legalItemText}>利用規約</Text>
            <Text style={styles.legalItemArrow}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.legalItem}
            onPress={() => navigation.navigate('Disclaimer')}
          >
            <Text style={styles.legalItemText}>免責事項</Text>
            <Text style={styles.legalItemArrow}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.legalItem}
            onPress={() => navigation.navigate('License')}
          >
            <Text style={styles.legalItemText}>ライセンス情報</Text>
            <Text style={styles.legalItemArrow}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.legalItem}
            onPress={() => Linking.openURL(SUPPORT_URL)}
          >
            <Text style={styles.legalItemText}>サポートサイト</Text>
            <Text style={styles.legalItemArrow}>↗</Text>
          </TouchableOpacity>
        </View>

        {/* バージョン情報 */}
        <View style={styles.section}>
          <Text style={styles.versionText}>傘判断アプリ v1.1.0</Text>
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
});
