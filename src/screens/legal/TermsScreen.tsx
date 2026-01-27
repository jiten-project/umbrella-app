import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
} from 'react-native';

export const TermsScreen: React.FC = () => {
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView}>
        <View style={styles.content}>
          <Text style={styles.title}>利用規約</Text>
          <Text style={styles.lastUpdated}>最終更新日: 2026年1月27日</Text>

          <Text style={styles.sectionTitle}>第1条（適用）</Text>
          <Text style={styles.paragraph}>
            本利用規約（以下「本規約」）は、傘持ってく？（以下「本アプリ」）の利用条件を定めるものです。ユーザーの皆様には、本規約に同意の上、本アプリをご利用いただきます。
          </Text>

          <Text style={styles.sectionTitle}>第2条（サービス内容）</Text>
          <Text style={styles.paragraph}>
            本アプリは、気象庁が提供する天気予報データを利用して、傘の要否を判断するための情報を提供するサービスです。
          </Text>
          <Text style={styles.listItem}>
            • 気象庁API（非公式）から取得した天気予報データの表示
          </Text>
          <Text style={styles.listItem}>
            • 降水確率・降水量に基づく傘の要否判断
          </Text>
          <Text style={styles.listItem}>
            • 出発地・目的地の天気情報の比較
          </Text>
          <Text style={styles.listItem}>
            • 曜日ごとの出発地・目的地・外出時間の設定
          </Text>
          <Text style={styles.listItem}>
            • 指定時刻でのプッシュ通知
          </Text>

          <Text style={styles.sectionTitle}>第3条（利用料金）</Text>
          <Text style={styles.paragraph}>
            本アプリは無料でご利用いただけます。ただし、インターネット通信に伴う通信料はユーザーのご負担となります。
          </Text>

          <Text style={styles.sectionTitle}>第4条（禁止事項）</Text>
          <Text style={styles.paragraph}>
            ユーザーは、本アプリの利用にあたり、以下の行為をしてはなりません。
          </Text>
          <Text style={styles.listItem}>
            • 本アプリの逆コンパイル、リバースエンジニアリング
          </Text>
          <Text style={styles.listItem}>
            • 本アプリを利用した営利活動
          </Text>
          <Text style={styles.listItem}>
            • 本アプリのサーバーに過度な負荷をかける行為
          </Text>
          <Text style={styles.listItem}>
            • その他、運営者が不適切と判断する行為
          </Text>

          <Text style={styles.sectionTitle}>第5条（データの取り扱い）</Text>
          <Text style={styles.paragraph}>
            本アプリは以下のデータを端末内にのみ保存し、外部サーバーへの送信は行いません。
          </Text>
          <Text style={styles.listItem}>
            • 登録した地点情報
          </Text>
          <Text style={styles.listItem}>
            • 通知設定
          </Text>
          <Text style={styles.listItem}>
            • 曜日別の外出時間・出発地・目的地設定
          </Text>
          <Text style={styles.listItem}>
            • 傘判断基準の設定
          </Text>
          <Text style={styles.listItem}>
            • 天気データのキャッシュ（15分間）
          </Text>

          <Text style={styles.sectionTitle}>第6条（位置情報）</Text>
          <Text style={styles.paragraph}>
            本アプリはGPS機能を利用して現在地を取得します。位置情報は天気予報の取得にのみ使用され、外部に送信されることはありません。位置情報の利用を許可しない場合は、設定画面から出発地を手動で選択してください。
          </Text>

          <Text style={styles.sectionTitle}>第7条（サービスの変更・中断）</Text>
          <Text style={styles.paragraph}>
            運営者は、以下の場合にサービスの全部または一部を変更・中断することがあります。
          </Text>
          <Text style={styles.listItem}>
            • 気象庁APIの仕様変更または提供終了
          </Text>
          <Text style={styles.listItem}>
            • システムメンテナンス
          </Text>
          <Text style={styles.listItem}>
            • 天災、事故その他の不可抗力
          </Text>

          <Text style={styles.sectionTitle}>第8条（規約の変更）</Text>
          <Text style={styles.paragraph}>
            運営者は、必要と判断した場合には、ユーザーに通知することなく本規約を変更することができます。変更後の利用規約は、本アプリ内に表示した時点から効力を生じるものとします。
          </Text>

          <Text style={styles.sectionTitle}>第9条（準拠法・裁判管轄）</Text>
          <Text style={styles.paragraph}>
            本規約の解釈にあたっては、日本法を準拠法とします。本アプリに関して紛争が生じた場合には、東京地方裁判所を専属的合意管轄とします。
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
