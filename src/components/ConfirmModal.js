import React from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Modal
} from 'react-native';

export default function ConfirmModal({
  visible,
  emoji = '⚠️',
  title,
  message,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  confirmColor = '#ef4444',
  onConfirm,
  onDismiss
}) {
  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onDismiss}>
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <Text style={styles.emoji}>{emoji}</Text>
          <Text style={styles.title}>{title}</Text>
          {message && <Text style={styles.message}>{message}</Text>}
          <View style={styles.divider} />
          <TouchableOpacity
            style={[styles.confirmBtn, { backgroundColor: confirmColor }]}
            onPress={onConfirm}
          >
            <Text style={styles.confirmBtnText}>{confirmText}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.cancelBtn} onPress={onDismiss}>
            <Text style={styles.cancelBtnText}>{cancelText}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center', alignItems: 'center', padding: 32
  },
  modal: {
    backgroundColor: '#1e1e1e', borderRadius: 24, padding: 28,
    width: '100%', borderWidth: 1, borderColor: '#333', alignItems: 'center'
  },
  emoji: { fontSize: 48, marginBottom: 12 },
  title: { fontSize: 20, fontWeight: 'bold', color: '#ffffff', marginBottom: 8, textAlign: 'center' },
  message: { color: '#aaaaaa', fontSize: 14, textAlign: 'center', lineHeight: 22, marginBottom: 4 },
  divider: { width: '100%', height: 1, backgroundColor: '#333', marginVertical: 20 },
  confirmBtn: {
    width: '100%', padding: 16,
    borderRadius: 14, alignItems: 'center', marginBottom: 10
  },
  confirmBtnText: { fontSize: 16, fontWeight: 'bold', color: '#ffffff' },
  cancelBtn: {
    width: '100%', padding: 14, borderRadius: 14,
    alignItems: 'center', borderWidth: 1, borderColor: '#333'
  },
  cancelBtnText: { color: '#aaaaaa', fontSize: 15 },
});