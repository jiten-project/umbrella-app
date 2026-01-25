import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Keyboard,
} from 'react-native';
import { searchAddress, LocationSearchResult } from '../services/nominatimService';

interface Props {
  visible: boolean;
  title: string;
  onSelectLocation: (location: {
    name: string;
    areaCode: string;
    latitude: number;
    longitude: number;
    detailedAddress: string;
  }) => void;
  onCancel: () => void;
}

export const LocationSearchModal: React.FC<Props> = ({
  visible,
  title,
  onSelectLocation,
  onCancel,
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<LocationSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // モーダルが閉じたらリセット
  useEffect(() => {
    if (!visible) {
      setQuery('');
      setResults([]);
      setError(null);
      setHasSearched(false);
      setIsSearching(false);
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    }
  }, [visible]);

  // デバウンス検索
  const handleSearch = useCallback((text: string) => {
    setQuery(text);
    setError(null);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    if (text.trim().length < 2) {
      setResults([]);
      setHasSearched(false);
      return;
    }

    setIsSearching(true);

    debounceTimerRef.current = setTimeout(async () => {
      const response = await searchAddress(text);

      if (response.success) {
        setResults(response.results);
        setHasSearched(true);
      } else {
        setError(response.error.message);
        setResults([]);
      }

      setIsSearching(false);
    }, 400); // 400ms デバウンス（Nominatimのレート制限対策）
  }, []);

  // 検索結果を選択
  const handleSelectResult = (result: LocationSearchResult) => {
    if (!result.areaCode) {
      setError('この地点の都道府県を特定できませんでした。別の地点を選択してください');
      return;
    }

    Keyboard.dismiss();

    onSelectLocation({
      name: result.mainText,
      areaCode: result.areaCode,
      latitude: result.latitude,
      longitude: result.longitude,
      detailedAddress: result.displayName,
    });
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onCancel}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* ヘッダー */}
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            <TouchableOpacity onPress={onCancel} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* 検索入力 */}
          <View style={styles.searchContainer}>
            <View style={styles.searchInputWrapper}>
              <Text style={styles.searchIcon}>🔍</Text>
              <TextInput
                style={styles.searchInput}
                placeholder="住所や場所名を検索..."
                placeholderTextColor="#999"
                value={query}
                onChangeText={handleSearch}
                autoFocus
                autoCorrect={false}
                returnKeyType="search"
              />
              {query.length > 0 && (
                <TouchableOpacity
                  onPress={() => {
                    setQuery('');
                    setResults([]);
                    setHasSearched(false);
                  }}
                  style={styles.clearButton}
                >
                  <Text style={styles.clearButtonText}>✕</Text>
                </TouchableOpacity>
              )}
            </View>
            {isSearching && (
              <ActivityIndicator
                size="small"
                color="#4A90D9"
                style={styles.spinner}
              />
            )}
          </View>

          {/* エラー表示 */}
          {error && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>⚠️ {error}</Text>
            </View>
          )}

          {/* 検索結果 */}
          <ScrollView
            style={styles.resultsList}
            keyboardShouldPersistTaps="handled"
          >
            {results.length > 0 ? (
              results.map((result) => (
                <TouchableOpacity
                  key={result.placeId}
                  style={[
                    styles.resultItem,
                    !result.areaCode && styles.resultItemDisabled,
                  ]}
                  onPress={() => handleSelectResult(result)}
                >
                  <View style={styles.resultContent}>
                    <Text style={styles.resultMainText}>{result.mainText}</Text>
                    <Text style={styles.resultSecondaryText} numberOfLines={2}>
                      {result.secondaryText}
                    </Text>
                  </View>
                  {result.prefecture && (
                    <View style={styles.prefectureBadge}>
                      <Text style={styles.prefectureBadgeText}>
                        {result.prefecture}
                      </Text>
                    </View>
                  )}
                  {!result.areaCode && (
                    <Text style={styles.warningIcon}>⚠️</Text>
                  )}
                </TouchableOpacity>
              ))
            ) : hasSearched && !isSearching ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateIcon}>🔍</Text>
                <Text style={styles.emptyStateText}>
                  結果が見つかりませんでした
                </Text>
                <Text style={styles.emptyStateHint}>
                  別のキーワードで検索してください
                </Text>
              </View>
            ) : !hasSearched ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateIcon}>📍</Text>
                <Text style={styles.emptyStateText}>
                  場所を検索してください
                </Text>
                <Text style={styles.emptyStateHint}>
                  例: 東京駅、渋谷、札幌市
                </Text>
              </View>
            ) : null}
          </ScrollView>

          {/* キャンセルボタン */}
          <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
            <Text style={styles.cancelButtonText}>キャンセル</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
    minHeight: '70%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  closeButton: {
    position: 'absolute',
    right: 16,
    padding: 4,
  },
  closeButtonText: {
    fontSize: 20,
    color: '#999',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  searchInputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  searchIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: 44,
    fontSize: 16,
    color: '#333',
  },
  clearButton: {
    padding: 4,
  },
  clearButtonText: {
    fontSize: 16,
    color: '#999',
  },
  spinner: {
    marginLeft: 12,
  },
  errorContainer: {
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 12,
    backgroundColor: '#fff3cd',
    borderRadius: 8,
  },
  errorText: {
    fontSize: 14,
    color: '#856404',
  },
  resultsList: {
    flex: 1,
  },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  resultItemDisabled: {
    opacity: 0.5,
  },
  resultContent: {
    flex: 1,
  },
  resultMainText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 2,
  },
  resultSecondaryText: {
    fontSize: 13,
    color: '#666',
  },
  prefectureBadge: {
    backgroundColor: '#e8f4fd',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginLeft: 8,
  },
  prefectureBadgeText: {
    fontSize: 12,
    color: '#4A90D9',
    fontWeight: '500',
  },
  warningIcon: {
    fontSize: 16,
    marginLeft: 8,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 20,
  },
  emptyStateIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptyStateHint: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
  cancelButton: {
    padding: 16,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 20,
    borderRadius: 12,
  },
  cancelButtonText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
});
