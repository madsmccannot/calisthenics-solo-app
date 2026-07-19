import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, radius } from '../theme';
import { LANGUAGES } from '../i18n/translations';

// Reusable language list. `value` = selected code, `onSelect(code)`.
export default function LanguagePicker({ value, onSelect }) {
  return (
    <View style={styles.container}>
      {LANGUAGES.map((l) => {
        const active = value === l.code;
        return (
          <TouchableOpacity
            key={l.code}
            style={[styles.row, active && styles.rowActive]}
            onPress={() => onSelect(l.code)}
            activeOpacity={0.7}
          >
            <Text style={[styles.label, active && styles.labelActive]}>{l.label}</Text>
            {active && <Text style={styles.check}>✓</Text>}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 8 },
  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.card, borderRadius: radius.lg, padding: 16,
    borderWidth: 1, borderColor: colors.border,
  },
  rowActive: { borderColor: colors.primary },
  label: { color: colors.text, fontSize: 16 },
  labelActive: { color: colors.primary, fontWeight: 'bold' },
  check: { color: colors.primary, fontSize: 16, fontWeight: 'bold' },
});
