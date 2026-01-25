import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { UmbrellaResult } from '../types';
import { loadSettings } from './storageService';

// 通知の設定
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// 通知の許可を要求
export const requestNotificationPermission = async (): Promise<boolean> => {
  const { status: existingStatus } = await Notifications.getPermissionsAsync();

  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    return false;
  }

  // Androidの場合は通知チャンネルを設定
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('umbrella', {
      name: '傘アラート',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
  }

  return true;
};

// 毎日の通知をスケジュール
export const scheduleDailyNotification = async (
  hour: number,
  minute: number
): Promise<string | null> => {
  try {
    // 既存の通知をキャンセル
    await cancelAllNotifications();

    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: '傘チェック',
        body: 'タップして今日の傘チェックを確認しましょう',
        data: { type: 'daily_check' },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour,
        minute,
      },
    });

    return id;
  } catch (error) {
    console.error('通知のスケジュールに失敗:', error);
    return null;
  }
};

// 即時通知を送信（傘判断結果）
export const sendUmbrellaNotification = async (
  result: UmbrellaResult,
  areaName: string
): Promise<void> => {
  const icon = result.decision === 'not_required' ? '☀️' : '☂️';
  const body = `${areaName}: ${result.message}（降水確率 ${result.maxPop}%）`;

  await Notifications.scheduleNotificationAsync({
    content: {
      title: `${icon} 傘持ってく？`,
      body,
      data: { type: 'umbrella_result', result },
    },
    trigger: null, // 即時送信
  });
};

// すべての予定された通知をキャンセル
export const cancelAllNotifications = async (): Promise<void> => {
  await Notifications.cancelAllScheduledNotificationsAsync();
};

// 通知リスナーを設定
export const addNotificationReceivedListener = (
  callback: (notification: Notifications.Notification) => void
): Notifications.EventSubscription => {
  return Notifications.addNotificationReceivedListener(callback);
};

export const addNotificationResponseReceivedListener = (
  callback: (response: Notifications.NotificationResponse) => void
): Notifications.EventSubscription => {
  return Notifications.addNotificationResponseReceivedListener(callback);
};

// 設定に基づいて通知をスケジュール/キャンセルする同期関数
export const syncDailyNotificationWithSettings = async (): Promise<void> => {
  const settings = await loadSettings();

  if (!settings.notificationEnabled) {
    await cancelAllNotifications();
    return;
  }

  const hasPermission = await requestNotificationPermission();
  if (!hasPermission) {
    await cancelAllNotifications();
    return;
  }

  const [hour, minute] = settings.notificationTime.split(':').map(Number);
  await scheduleDailyNotification(hour, minute);
};
