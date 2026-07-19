import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal } from 'react-native';
import { colors, radius } from '../theme';

// Single-button info modal in the app's style (replaces the native Alert).
export default function InfoModal({
  visible,
  emoji = 'ℹ️',
  title,
  message,
  buttonText = 'Entendido',
  onDismiss,
}) {
  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onDismiss}>
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <Text style={styles.emoji}>{emoji}</Text>
          <Text style={styles.title}>{title}</Text>
          {message ? <Text style={styles.message}>{message}</Text> : null}
          <View style={styles.divider} />
          <TouchableOpacity style={styles.btn} onPress={onDismiss}>
            <Text style={styles.btnText}>{buttonText}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  modal: {
    backgroundColor: colors.card,
    borderRadius: radius.round,
    padding: 28,
    width: '100%',
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  emoji: { fontSize: 48, marginBottom: 12 },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  message: { color: colors.textMuted, fontSize: 14, textAlign: 'center', lineHeight: 22 },
  divider: { width: '100%', height: 1, backgroundColor: colors.border, marginVertical: 20 },
  btn: {
    width: '100%',
    padding: 16,
    borderRadius: radius.lg,
    alignItems: 'center',
    backgroundColor: colors.primary,
  },
  btnText: { fontSize: 16, fontWeight: 'bold', color: colors.onPrimary },
});
