import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { UmbrellaResult, DayOfWeek, Settings, CombinedUmbrellaResult } from '../types';
import { loadSettings, DAY_NAMES, getTodaySchedule } from './storageService';
import { fetchWeatherForecast, determineUmbrella, determineCombinedUmbrella } from './weatherApi';
import { getCurrentLocation } from './locationService';

// 通知の設定
Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const type = notification.request.content.data?.type;

    // スケジュール通知（daily_check, before_outing）はフォアグラウンドで
    // 傘判断結果付き通知に置き換えるため、元の静的通知を抑制する
    if (type === 'daily_check' || type === 'before_outing') {
      return {
        shouldShowAlert: false,
        shouldPlaySound: false,
        shouldSetBadge: false,
        shouldShowBanner: false,
        shouldShowList: false,
      };
    }

    return {
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    };
  },
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
    // 固定時刻通知のみキャンセル（外出前通知は維持）
    await cancelFixedNotifications();

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

// 傘判断を含む通知を生成するヘルパー
const getUmbrellaNotificationContent = (
  combinedResult: CombinedUmbrellaResult
): { title: string; body: string } => {
  const decision = combinedResult.overallDecision;
  const icon =
    decision === 'required' ? '☂️' :
    decision === 'recommended' ? '🌂' : '☀️';

  // 最大降水確率を計算
  const maxPop = Math.max(
    combinedResult.origin?.result.maxPop ?? 0,
    combinedResult.destination?.result.maxPop ?? 0
  );

  const title = `${icon} 傘持ってく？`;
  let body = combinedResult.overallMessage;

  // 降水確率があれば追加
  if (maxPop > 0) {
    body += `（降水確率 ${maxPop}%）`;
  }

  return { title, body };
};

// 天気を取得して傘判断結果付きの通知を送信
export const sendUmbrellaCheckNotification = async (): Promise<void> => {
  try {
    const settings = await loadSettings();
    const todaySchedule = getTodaySchedule(settings);

    // 外出予定がない日は通知しない
    if (!todaySchedule) {
      return;
    }

    const outingTime = {
      start: todaySchedule.outingStart,
      end: todaySchedule.outingEnd,
    };

    let originResult;
    let destinationResult;

    // 出発地の天気を取得
    if (todaySchedule.originLocationId) {
      const originLocation = settings.locations.find(
        loc => loc.id === todaySchedule.originLocationId
      );
      if (originLocation) {
        const forecast = await fetchWeatherForecast(originLocation.areaCode);
        originResult = {
          location: originLocation,
          result: determineUmbrella(forecast, outingTime, settings.umbrellaCriteria),
        };
      }
    } else {
      // GPS使用
      try {
        const locationResult = await getCurrentLocation();
        if (locationResult.success && locationResult.areaCode) {
          const forecast = await fetchWeatherForecast(locationResult.areaCode);
          const gpsLocation = {
            id: 'gps',
            name: locationResult.areaName || '現在地',
            areaCode: locationResult.areaCode,
            isGPS: true,
          };
          originResult = {
            location: gpsLocation,
            result: determineUmbrella(forecast, outingTime, settings.umbrellaCriteria),
          };
        }
      } catch {
        // GPS取得失敗時はスキップ
      }
    }

    // 目的地の天気を取得
    if (todaySchedule.destinationLocationId) {
      const destLocation = settings.locations.find(
        loc => loc.id === todaySchedule.destinationLocationId
      );
      if (destLocation) {
        const forecast = await fetchWeatherForecast(destLocation.areaCode);
        destinationResult = {
          location: destLocation,
          result: determineUmbrella(forecast, outingTime, settings.umbrellaCriteria),
        };
      }
    }

    // 傘判断がない場合は汎用メッセージ
    if (!originResult && !destinationResult) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '☔ 傘チェック',
          body: 'タップして今日の傘チェックを確認しましょう',
          data: { type: 'daily_check' },
        },
        trigger: null,
      });
      return;
    }

    // 総合判断
    const combinedResult = determineCombinedUmbrella(originResult, destinationResult);
    const { title, body } = getUmbrellaNotificationContent(combinedResult);

    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: { type: 'umbrella_result', result: combinedResult },
      },
      trigger: null,
    });
  } catch (error) {
    console.error('傘判断通知の送信に失敗:', error);
    // エラー時はフォールバック
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '☔ 傘チェック',
        body: 'タップして今日の傘チェックを確認しましょう',
        data: { type: 'daily_check' },
      },
      trigger: null,
    });
  }
};

// すべての予定された通知をキャンセル
export const cancelAllNotifications = async (): Promise<void> => {
  await Notifications.cancelAllScheduledNotificationsAsync();
};

// 固定時刻通知のみキャンセル
const cancelFixedNotifications = async (): Promise<void> => {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  for (const notification of scheduled) {
    if (notification.content.data?.type === 'daily_check') {
      await Notifications.cancelScheduledNotificationAsync(notification.identifier);
    }
  }
};

// 外出前通知のみキャンセル
const cancelBeforeOutingNotifications = async (): Promise<void> => {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  for (const notification of scheduled) {
    if (notification.content.data?.type === 'before_outing') {
      await Notifications.cancelScheduledNotificationAsync(notification.identifier);
    }
  }
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

// 曜日ごとの外出前通知をスケジュール
export const scheduleBeforeOutingNotifications = async (
  settings: Settings
): Promise<void> => {
  // 外出前通知のみキャンセル（固定時刻通知は維持）
  await cancelBeforeOutingNotifications();

  if (!settings.weeklySchedule) return;

  // 外出前の通知時間（デフォルト30分）
  const leadTime = settings.notificationLeadTime ?? 30;

  // 各曜日の通知をスケジュール
  for (let day = 0; day <= 6; day++) {
    const dayOfWeek = day as DayOfWeek;
    const schedule = settings.weeklySchedule[dayOfWeek];

    // 外出予定がない日はスキップ
    if (!schedule || !schedule.enabled) continue;

    // 外出開始時刻からleadTime分前を計算
    const [startHour, startMinute] = schedule.outingStart.split(':').map(Number);
    let notifyHour = startHour;
    let notifyMinute = startMinute - leadTime;

    // 分がマイナスになる場合は時間を調整
    while (notifyMinute < 0) {
      notifyMinute += 60;
      notifyHour -= 1;
    }
    if (notifyHour < 0) {
      notifyHour += 24;
    }

    try {
      // 週次トリガーで通知をスケジュール（1=日曜, 2=月曜, ..., 7=土曜）
      // JavaScriptのgetDay()は0=日曜だが、expo-notificationsのweekdayは1=日曜
      const weekday = day + 1;

      // 通知メッセージを動的に生成
      const leadTimeText = leadTime >= 60
        ? `${Math.floor(leadTime / 60)}時間${leadTime % 60 > 0 ? `${leadTime % 60}分` : ''}`
        : `${leadTime}分`;

      await Notifications.scheduleNotificationAsync({
        content: {
          title: '傘チェック',
          body: `${DAY_NAMES[dayOfWeek]}曜日の外出${leadTimeText}前です。傘を確認しましょう`,
          data: { type: 'before_outing', dayOfWeek },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
          weekday,
          hour: notifyHour,
          minute: notifyMinute,
        },
      });
    } catch (error) {
      console.error(`${DAY_NAMES[dayOfWeek]}曜日の通知スケジュールに失敗:`, error);
    }
  }
};

// 設定に基づいて通知をスケジュール/キャンセルする同期関数
export const syncDailyNotificationWithSettings = async (): Promise<void> => {
  const settings = await loadSettings();

  // どちらも無効なら権限リクエストせずキャンセルのみ
  if (!settings.notificationEnabled && !settings.beforeOutingNotificationEnabled) {
    await cancelFixedNotifications();
    await cancelBeforeOutingNotifications();
    return;
  }

  const hasPermission = await requestNotificationPermission();

  // 固定時刻通知
  if (settings.notificationEnabled && hasPermission) {
    const [hour, minute] = settings.notificationTime.split(':').map(Number);
    await scheduleDailyNotification(hour, minute);
  } else {
    await cancelFixedNotifications();
  }

  // 外出前通知
  if (settings.beforeOutingNotificationEnabled && hasPermission) {
    await scheduleBeforeOutingNotifications(settings);
  } else {
    await cancelBeforeOutingNotifications();
  }
};
