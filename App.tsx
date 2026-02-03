import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { HomeScreen } from './src/screens/HomeScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { TermsScreen, DisclaimerScreen, LicenseScreen } from './src/screens/legal';
import {
  addNotificationReceivedListener,
  addNotificationResponseReceivedListener,
  syncDailyNotificationWithSettings,
  sendUmbrellaCheckNotification,
} from './src/services/notificationService';
import { ThemeProvider, useTheme } from './src/theme';

type RootStackParamList = {
  Home: undefined;
  Settings: undefined;
  Terms: undefined;
  Disclaimer: undefined;
  License: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

// テーマ対応のナビゲーションコンテンツ
const AppContent: React.FC = () => {
  const { theme, isDark } = useTheme();

  useEffect(() => {
    // 設定に基づいて通知を同期
    syncDailyNotificationWithSettings();

    // 通知リスナーの設定
    const receivedSubscription = addNotificationReceivedListener((notification) => {
      console.log('通知を受信:', notification);
      // スケジュール通知（傘チェックリマインダー）を受信したら、実際の傘判断を行う
      const notificationType = notification.request.content.data?.type;
      if (notificationType === 'daily_check' || notificationType === 'before_outing') {
        // 傘判断結果を取得して通知を更新
        sendUmbrellaCheckNotification().catch(console.error);
      }
    });

    const responseSubscription = addNotificationResponseReceivedListener((response) => {
      console.log('通知をタップ:', response);
    });

    return () => {
      receivedSubscription.remove();
      responseSubscription.remove();
    };
  }, []);

  // ナビゲーションテーマをカスタマイズ
  const navigationTheme = isDark
    ? {
        ...DarkTheme,
        colors: {
          ...DarkTheme.colors,
          background: theme.background,
          card: theme.card,
          text: theme.text,
          border: theme.border,
          primary: theme.primary,
        },
      }
    : {
        ...DefaultTheme,
        colors: {
          ...DefaultTheme.colors,
          background: theme.background,
          card: theme.card,
          text: theme.text,
          border: theme.border,
          primary: theme.primary,
        },
      };

  return (
    <NavigationContainer theme={navigationTheme}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack.Navigator
        initialRouteName="Home"
        screenOptions={{
          headerStyle: {
            backgroundColor: theme.card,
          },
          headerTintColor: theme.text,
          headerTitleStyle: {
            fontWeight: '600',
          },
          headerShadowVisible: false,
        }}
      >
        <Stack.Screen
          name="Home"
          component={HomeScreen}
          options={{
            title: '傘判断',
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="Settings"
          component={SettingsScreen}
          options={{
            title: '設定',
          }}
        />
        <Stack.Screen
          name="Terms"
          component={TermsScreen}
          options={{
            title: '利用規約',
          }}
        />
        <Stack.Screen
          name="Disclaimer"
          component={DisclaimerScreen}
          options={{
            title: '免責事項',
          }}
        />
        <Stack.Screen
          name="License"
          component={LicenseScreen}
          options={{
            title: 'ライセンス情報',
          }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}
