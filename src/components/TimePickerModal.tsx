import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
} from 'react-native';

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
  const minutes = [0, 15, 30, 45];

  // 最も近い分を見つける（例: 5 → 0, 10 → 15, 25 → 30）
  const findClosestMinute = (target: number): number => {
    let closest = minutes[0];
    let minDiff = Math.abs(target - closest);
    for (const m of minutes) {
      const diff = Math.abs(target - m);
      if (diff < minDiff) {
        minDiff = diff;
        closest = m;
      }
    }
    return closest;
  };

  const [selectedHour, setSelectedHour] = useState(initialHour);
  const [selectedMinute, setSelectedMinute] = useState(() => findClosestMinute(initialMinute));

  const hourScrollRef = useRef<ScrollView>(null);
  const minuteScrollRef = useRef<ScrollView>(null);

  // モーダルが開いたときに初期値にリセット＆スクロール
  useEffect(() => {
    if (visible) {
      const closestMinute = findClosestMinute(initialMinute);
      setSelectedHour(initialHour);
      setSelectedMinute(closestMinute);

      // 選択項目までスクロール（少し遅延させる）
      setTimeout(() => {
        const itemHeight = 44; // paddingVertical: 10 + fontSize考慮

        // 時のスクロール
        hourScrollRef.current?.scrollTo({
          y: Math.max(0, initialHour * itemHeight - itemHeight),
          animated: false,
        });

        // 分のスクロール
        const minuteIndex = minutes.indexOf(closestMinute);
        minuteScrollRef.current?.scrollTo({
          y: Math.max(0, minuteIndex * itemHeight),
          animated: false,
        });
      }, 100);
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
              <ScrollView ref={hourScrollRef} style={styles.scrollView}>
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
              <ScrollView ref={minuteScrollRef} style={styles.scrollView}>
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
    maxHeight: '60%',
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
  },
  pickerLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 10,
  },
  scrollView: {
    height: 150,
    width: 60,
  },
  pickerItem: {
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  pickerItemSelected: {
    backgroundColor: '#4A90D9',
  },
  pickerItemText: {
    fontSize: 20,
    color: '#333',
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
