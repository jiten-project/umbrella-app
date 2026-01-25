import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
} from 'react-native';

// 定数を統一して管理
const ITEM_HEIGHT = 44;
const VISIBLE_ITEMS = 3; // 表示する項目数（奇数が望ましい）
const SCROLL_VIEW_HEIGHT = ITEM_HEIGHT * VISIBLE_ITEMS;
const SIDE_PADDING = (SCROLL_VIEW_HEIGHT - ITEM_HEIGHT) / 2; // 上下パディング

interface Props {
  visible: boolean;
  title: string;
  initialHour: number;
  initialMinute: number;
  onConfirm: (hour: number, minute: number) => void;
  onCancel: () => void;
}

export const TimePickerModal: React.FC<Props> = ({
  visible,
  title,
  initialHour,
  initialMinute,
  onConfirm,
  onCancel,
}) => {
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const minutes = Array.from({ length: 60 }, (_, i) => i); // 1分刻み

  // 分の値を0-59の範囲に正規化
  const normalizeMinute = (target: number): number => {
    return Math.max(0, Math.min(59, target));
  };

  const [selectedHour, setSelectedHour] = useState(initialHour);
  const [selectedMinute, setSelectedMinute] = useState(() => normalizeMinute(initialMinute));

  const hourScrollRef = useRef<ScrollView>(null);
  const minuteScrollRef = useRef<ScrollView>(null);

  // モーダルが開いたときに初期値にリセット＆スクロール
  useEffect(() => {
    if (visible) {
      const normalizedMinute = normalizeMinute(initialMinute);
      setSelectedHour(initialHour);
      setSelectedMinute(normalizedMinute);

      // requestAnimationFrameで確実にレンダリング後にスクロール
      requestAnimationFrame(() => {
        // 時のスクロール（パディングがあるのでindex * ITEM_HEIGHTで中央に来る）
        hourScrollRef.current?.scrollTo({
          y: initialHour * ITEM_HEIGHT,
          animated: false,
        });

        // 分のスクロール（1分刻みなのでindexは分の値と同じ）
        minuteScrollRef.current?.scrollTo({
          y: normalizedMinute * ITEM_HEIGHT,
          animated: false,
        });
      });
    }
  }, [visible, initialHour, initialMinute]);

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.container}>
          <Text style={styles.title}>{title}</Text>

          <View style={styles.pickerContainer}>
            <View style={styles.pickerColumn}>
              <Text style={styles.pickerLabel}>時</Text>
              <ScrollView
                ref={hourScrollRef}
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
              >
                {hours.map((hour) => (
                  <TouchableOpacity
                    key={hour}
                    style={[
                      styles.pickerItem,
                      selectedHour === hour && styles.pickerItemSelected,
                    ]}
                    onPress={() => setSelectedHour(hour)}
                  >
                    <Text
                      style={[
                        styles.pickerItemText,
                        selectedHour === hour && styles.pickerItemTextSelected,
                      ]}
                    >
                      {hour.toString().padStart(2, '0')}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            <Text style={styles.separator}>:</Text>

            <View style={styles.pickerColumn}>
              <Text style={styles.pickerLabel}>分</Text>
              <ScrollView
                ref={minuteScrollRef}
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
              >
                {minutes.map((minute) => (
                  <TouchableOpacity
                    key={minute}
                    style={[
                      styles.pickerItem,
                      selectedMinute === minute && styles.pickerItemSelected,
                    ]}
                    onPress={() => setSelectedMinute(minute)}
                  >
                    <Text
                      style={[
                        styles.pickerItemText,
                        selectedMinute === minute && styles.pickerItemTextSelected,
                      ]}
                    >
                      {minute.toString().padStart(2, '0')}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>

          <View style={styles.buttonContainer}>
            <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
              <Text style={styles.cancelButtonText}>キャンセル</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.confirmButton}
              onPress={() => onConfirm(selectedHour, selectedMinute)}
            >
              <Text style={styles.confirmButtonText}>決定</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    width: '80%',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 20,
    color: '#333',
  },
  pickerContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pickerColumn: {
    alignItems: 'center',
    width: 70,
  },
  pickerLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 10,
  },
  scrollView: {
    height: SCROLL_VIEW_HEIGHT,
    width: 70,
  },
  scrollContent: {
    paddingVertical: SIDE_PADDING,
  },
  pickerItem: {
    height: ITEM_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
    width: 60,
    marginHorizontal: 5,
  },
  pickerItemSelected: {
    backgroundColor: '#4A90D9',
  },
  pickerItemText: {
    fontSize: 20,
    color: '#333',
    lineHeight: ITEM_HEIGHT,
    textAlign: 'center',
  },
  pickerItemTextSelected: {
    color: '#fff',
    fontWeight: '600',
  },
  separator: {
    fontSize: 24,
    marginHorizontal: 10,
    color: '#333',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  cancelButton: {
    flex: 1,
    padding: 15,
    marginRight: 10,
    borderRadius: 10,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    color: '#666',
  },
  confirmButton: {
    flex: 1,
    padding: 15,
    marginLeft: 10,
    borderRadius: 10,
    backgroundColor: '#4A90D9',
    alignItems: 'center',
  },
  confirmButtonText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },
});
