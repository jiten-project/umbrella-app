import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
} from 'react-native';

export const DisclaimerScreen: React.FC = () => {
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView}>
        <View style={styles.content}>
          <Text style={styles.title}>免責事項</Text>
          <Text style={styles.lastUpdated}>最終更新日: 2026年2月3日</Text>

          <Text style={styles.sectionTitle}>1. 天気予報データについて</Text>
          <Text style={styles.paragraph}>
            本アプリは、気象庁が提供する天気予報データ（非公式API）を利用しています。このデータは気象庁により随時更新されますが、以下の点にご注意ください。
          </Text>
          <Text style={styles.listItem}>
            • 天気予報は予測であり、実際の天気と異なる場合があります
          </Text>
          <Text style={styles.listItem}>
            • 気象庁APIの仕様変更により、データが取得できなくなる可能性があります
          </Text>
          <Text style={styles.listItem}>
            • 予報データの更新タイミングにより、最新情報と異なる場合があります
          </Text>

          <Text style={styles.sectionTitle}>2. 傘判断ロジックについて</Text>
          <Text style={styles.paragraph}>
            本アプリの傘判断は、曜日ごとに設定した出発地・目的地・外出時間と、ユーザーが設定した判断基準に基づいて自動的に行われます。
          </Text>
          <Text style={styles.listItem}>
            • 降水確率の閾値（0%〜100%から選択可能、初期値50%）
          </Text>
          <Text style={styles.listItem}>
            • 降水量の閾値（0mm〜20mmから選択可能、初期値1mm）
          </Text>
          <Text style={styles.listItem}>
            • 条件の組み合わせ（「または」「かつ」から選択可能）
          </Text>
          <Text style={styles.paragraph}>
            閾値を超えた場合は「傘が必要」、閾値の60%以上の場合は「念のため折りたたみ傘を推奨」と判断されます。
          </Text>
          <Text style={styles.paragraph}>
            この判断基準はユーザーが設定した目安であり、急な天気の変化や局地的な雨には対応できない場合があります。最終的な判断はユーザーご自身の責任で行ってください。
          </Text>

          <Text style={styles.sectionTitle}>3. 位置情報について</Text>
          <Text style={styles.paragraph}>
            GPS機能による現在地取得には、以下の制約があります。
          </Text>
          <Text style={styles.listItem}>
            • 建物内や地下では正確な位置を取得できない場合があります
          </Text>
          <Text style={styles.listItem}>
            • 逆ジオコーディングにより都道府県を特定できない場合があります
          </Text>
          <Text style={styles.listItem}>
            • 海外では天気予報を取得できません（日本国内のみ対応）
          </Text>

          <Text style={styles.sectionTitle}>4. 通知機能について</Text>
          <Text style={styles.paragraph}>
            本アプリは「固定時刻通知」と「外出前通知」の2種類の通知を提供しています。いずれの通知も、端末の状態やOSの省電力機能により、指定時刻に届かない場合があります。重要な外出の際は、アプリを直接開いて最新情報をご確認ください。
          </Text>

          <Text style={styles.sectionTitle}>5. 損害の免責</Text>
          <Text style={styles.paragraph}>
            本アプリの利用により生じた以下の損害について、運営者は一切の責任を負いません。
          </Text>
          <Text style={styles.listItem}>
            • 天気予報の誤りによる損害（濡れた、傘を無駄に持っていったなど）
          </Text>
          <Text style={styles.listItem}>
            • アプリの不具合、エラーによる損害
          </Text>
          <Text style={styles.listItem}>
            • サービスの中断、終了による損害
          </Text>
          <Text style={styles.listItem}>
            • 端末の故障、データの消失による損害
          </Text>

          <Text style={styles.sectionTitle}>6. 推奨環境</Text>
          <Text style={styles.paragraph}>
            本アプリは以下の環境での動作を想定しています。これ以外の環境では正常に動作しない場合があります。
          </Text>
          <Text style={styles.listItem}>• iOS 15.0 以降</Text>
          <Text style={styles.listItem}>• Android 10.0 以降</Text>
          <Text style={styles.listItem}>• インターネット接続環境</Text>

          <Text style={styles.sectionTitle}>7. お問い合わせ</Text>
          <Text style={styles.paragraph}>
            本アプリに関するお問い合わせは、アプリ内の「サポート」からお願いいたします。なお、天気予報の精度に関するお問い合わせにはお答えできません。
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
    marginBottom: 8,
  },
  lastUpdated: {
    fontSize: 12,
    color: '#999',
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
  footer: {
    height: 40,
  },
});
