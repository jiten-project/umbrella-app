import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { HomeScreen } from './src/screens/HomeScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { TermsScreen, DisclaimerScreen, LicenseScreen } from './src/screens/legal';
import {
  addNotificationReceivedListener,
  addNotificationResponseReceivedListener,
  syncDailyNotificationWithSettings,
} from './src/services/notificationService';

type RootStackParamList = {
  Home: undefined;
  Settings: undefined;
  Terms: undefined;
  Disclaimer: undefined;
  License: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  useEffect(() => {
    // 設定に基づいて通知を同期
    syncDailyNotificationWithSettings();

    // 通知リスナーの設定
    const receivedSubscription = addNotificationReceivedListener((notification) => {
      console.log('通知を受信:', notification);
    });

    const responseSubscription = addNotificationResponseReceivedListener((response) => {
      console.log('通知をタップ:', response);
    });

    return () => {
      receivedSubscription.remove();
      responseSubscription.remove();
    };
  }, []);

  return (
    <NavigationContainer>
      <StatusBar style="dark" />
      <Stack.Navigator
        initialRouteName="Home"
        screenOptions={{
          headerStyle: {
            backgroundColor: '#fff',
          },
          headerTintColor: '#333',
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
}
