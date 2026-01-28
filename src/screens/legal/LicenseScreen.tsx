import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
} from 'react-native';

interface LicenseItemProps {
  name: string;
  license: string;
  url?: string;
}

const LicenseItem: React.FC<LicenseItemProps> = ({ name, license, url }) => (
  <View style={styles.licenseItem}>
    <Text style={styles.licenseName}>{name}</Text>
    <Text style={styles.licenseType}>{license}</Text>
    {url && <Text style={styles.licenseUrl}>{url}</Text>}
  </View>
);

export const LicenseScreen: React.FC = () => {
  const licenses: LicenseItemProps[] = [
    {
      name: 'React',
      license: 'MIT License',
      url: 'https://github.com/facebook/react',
    },
    {
      name: 'React Native',
      license: 'MIT License',
      url: 'https://github.com/facebook/react-native',
    },
    {
      name: 'Expo',
      license: 'MIT License',
      url: 'https://github.com/expo/expo',
    },
    {
      name: 'expo-location',
      license: 'MIT License',
      url: 'https://github.com/expo/expo',
    },
    {
      name: 'expo-notifications',
      license: 'MIT License',
      url: 'https://github.com/expo/expo',
    },
    {
      name: 'expo-background-fetch',
      license: 'MIT License',
      url: 'https://github.com/expo/expo',
    },
    {
      name: 'expo-task-manager',
      license: 'MIT License',
      url: 'https://github.com/expo/expo',
    },
    {
      name: 'expo-status-bar',
      license: 'MIT License',
      url: 'https://github.com/expo/expo',
    },
    {
      name: '@react-navigation/native',
      license: 'MIT License',
      url: 'https://github.com/react-navigation/react-navigation',
    },
    {
      name: '@react-navigation/native-stack',
      license: 'MIT License',
      url: 'https://github.com/react-navigation/react-navigation',
    },
    {
      name: '@react-native-async-storage/async-storage',
      license: 'MIT License',
      url: 'https://github.com/react-native-async-storage/async-storage',
    },
    {
      name: 'react-native-safe-area-context',
      license: 'MIT License',
      url: 'https://github.com/th3rdwave/react-native-safe-area-context',
    },
    {
      name: 'react-native-screens',
      license: 'MIT License',
      url: 'https://github.com/software-mansion/react-native-screens',
    },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView}>
        <View style={styles.content}>
          <Text style={styles.title}>ライセンス情報</Text>

          <Text style={styles.sectionTitle}>本アプリについて</Text>
          <Text style={styles.paragraph}>
            傘持ってく？（バージョン 1.1.0）
          </Text>
          <Text style={styles.paragraph}>
            Copyright (c) 2026 傘持ってく？開発チーム
          </Text>

          <Text style={styles.sectionTitle}>気象データ</Text>
          <Text style={styles.paragraph}>
            本アプリは、気象庁が提供する天気予報データを利用しています。
          </Text>
          <Text style={styles.listItem}>
            データ提供元: 気象庁 (https://www.jma.go.jp/)
          </Text>
          <Text style={styles.listItem}>
            API: 気象庁天気予報API（非公式）
          </Text>
          <Text style={styles.paragraph}>
            気象庁のデータは、政府標準利用規約（第2.0版）に基づき利用しています。
          </Text>

          <Text style={styles.sectionTitle}>地点検索</Text>
          <Text style={styles.paragraph}>
            本アプリは、住所・地名検索機能にOpenStreetMap Nominatim APIを利用しています。
          </Text>
          <Text style={styles.listItem}>
            データ提供元: OpenStreetMap contributors
          </Text>
          <Text style={styles.listItem}>
            API: Nominatim (https://nominatim.openstreetmap.org/)
          </Text>
          <Text style={styles.paragraph}>
            OpenStreetMapのデータはODbL (Open Database License) に基づき利用しています。
          </Text>

          <Text style={styles.sectionTitle}>オープンソースライセンス</Text>
          <Text style={styles.paragraph}>
            本アプリは以下のオープンソースソフトウェアを使用しています。
          </Text>

          {licenses.map((license, index) => (
            <LicenseItem key={index} {...license} />
          ))}

          <Text style={styles.sectionTitle}>MIT License</Text>
          <Text style={styles.licenseText}>
            {`Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.`}
          </Text>

          <View style={styles.footer} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginTop: 20,
    marginBottom: 10,
  },
  paragraph: {
    fontSize: 14,
    color: '#666',
    lineHeight: 22,
    marginBottom: 10,
  },
  listItem: {
    fontSize: 14,
    color: '#666',
    lineHeight: 22,
    marginLeft: 10,
    marginBottom: 5,
  },
  licenseItem: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
  },
  licenseName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  licenseType: {
    fontSize: 12,
    color: '#4A90D9',
    marginBottom: 2,
  },
  licenseUrl: {
    fontSize: 11,
    color: '#999',
  },
  licenseText: {
    fontSize: 11,
    color: '#888',
    lineHeight: 18,
    fontFamily: 'Courier',
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 10,
    marginTop: 10,
  },
  footer: {
    height: 40,
  },
});
