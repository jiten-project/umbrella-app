# コーディング規約

## 基本設定

- TypeScript strict / React Native + Expo SDK 54
- Prettier + ESLint / 2スペース / シングルクォート / セミコロンあり

## 命名規則

| 種類 | 規則 | 例 |
|------|------|-----|
| コンポーネント | PascalCase | `BookCard.tsx` |
| フック | use接頭辞 | `useDatabase.ts` |
| 関数 | camelCase | `fetchBooks` |
| 定数 | UPPER_SNAKE_CASE | `MAX_COUNT` |
| 型 | PascalCase | `BookStatus` |

## インポート順序

```typescript
// 1. React関連
import { useState } from 'react';
import { View } from 'react-native';
// 2. 外部ライブラリ
import { useNavigation } from '@react-navigation/native';
// 3. 内部（contexts, hooks, store）
import { useTheme } from '../contexts';
// 4. サービス・ユーティリティ
import { fetchBooks } from '../services/bookApi';
// 5. 型・定数
import { Book } from '../types';
```

## 状態管理

- **Zustand**: グローバル状態（`src/store/`）
- **Context**: 設定・認証（`src/contexts/`）
- **useState**: ローカル状態

## パターン

```typescript
// コンポーネント: memo + StyleSheet
export default memo(Component);
const styles = StyleSheet.create({...});

// フック: useCallback + useMemo
const handlePress = useCallback(() => {...}, [deps]);
const sorted = useMemo(() => list.sort(...), [list]);

// テーマ対応スタイル
const themedStyles = useMemo(() => ({
  container: { backgroundColor: colors.background },
}), [colors]);

// エラーハンドリング
logError('context:operation', error);  // 致命的
logWarn('context:optional', 'msg');    // 非致命的
```

## 定数定義

```typescript
export const EXAMPLE = {
  MAX_COUNT: 100,
} as const;

export const STATUS_LABELS: Record<Status, string> = {
  pending: '保留中',
};
```

## 禁止事項

- `any`型 → `unknown`を使用
- `console.log` → `logDebug`を使用
- インラインスタイル多用 → StyleSheet
- マジックナンバー → 定数に抽出
