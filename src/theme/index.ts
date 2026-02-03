import React, { createContext, useContext } from 'react';
import { useColorScheme, ColorSchemeName } from 'react-native';

// テーマの型定義
export interface Theme {
  background: string;
  card: string;
  cardSecondary: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  primary: string;
  border: string;
  inputBackground: string;
  // 傘判断カードの色
  umbrellaRequired: string;
  umbrellaRecommended: string;
  umbrellaNotRequired: string;
}

// ライトテーマ
export const lightTheme: Theme = {
  background: '#f5f5f5',
  card: '#ffffff',
  cardSecondary: '#f8f8f8',
  text: '#333333',
  textSecondary: '#666666',
  textMuted: '#999999',
  primary: '#4A90D9',
  border: '#e0e0e0',
  inputBackground: '#f0f0f0',
  umbrellaRequired: '#E74C3C',
  umbrellaRecommended: '#F39C12',
  umbrellaNotRequired: '#27AE60',
};

// ダークテーマ
export const darkTheme: Theme = {
  background: '#1a1a1a',
  card: '#2d2d2d',
  cardSecondary: '#3a3a3a',
  text: '#ffffff',
  textSecondary: '#aaaaaa',
  textMuted: '#777777',
  primary: '#5a9fe9',
  border: '#404040',
  inputBackground: '#3a3a3a',
  umbrellaRequired: '#E74C3C',
  umbrellaRecommended: '#F39C12',
  umbrellaNotRequired: '#27AE60',
};

// テーマコンテキスト
interface ThemeContextType {
  theme: Theme;
  isDark: boolean;
  colorScheme: ColorSchemeName;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: lightTheme,
  isDark: false,
  colorScheme: 'light',
});

// テーマプロバイダーのProps
interface ThemeProviderProps {
  children: React.ReactNode;
}

// テーマプロバイダー
export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const theme = isDark ? darkTheme : lightTheme;

  return React.createElement(
    ThemeContext.Provider,
    { value: { theme, isDark, colorScheme } },
    children
  );
};

// テーマを使用するフック
export const useTheme = (): ThemeContextType => {
  return useContext(ThemeContext);
};
