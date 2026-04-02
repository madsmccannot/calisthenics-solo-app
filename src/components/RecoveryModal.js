import React, { useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Modal, Animated
} from 'react-native';

export default function RecoveryModal({ visible, onDismiss, onComplete }) {
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1, duration: 250, useNativeDriver: true
        }),
        Animated.spring(scaleAnim, {
          toValue: 1, friction: 5, tension: 50, useNativeDriver: true
        }),
      ]).start();
    } else {
      fadeAnim.setValue(0);
      scaleAnim.setValue(0.8);
    }
  }, [visible]);

  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={onDismiss}>
      <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
        <Animated.View style={[styles.modal, { transform: [{ scale: scaleAnim }] }]}>

          <Text style={styles.emoji}>🧘</Text>
          <Text style={styles.title}>Dia de Recuperação</Text>
          <Text style={styles.body}>
            O teu corpo precisa descansar para crescer mais forte.{'\n\n'}
            Aproveita para alongar, caminhar ou simplesmente descansar.
          </Text>

          <View style={styles.divider} />

          <TouchableOpacity style={styles.completeBtn} onPress={onComplete}>
            <Text style={styles.completeBtnText}>✓ Marcar como feito</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.dismissBtn} onPress={onDismiss}>
            <Text style={styles.dismissBtnText}>Fechar</Text>
          </TouchableOpacity>

        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center', alignItems: 'center', padding: 32
  },
  modal: {
    backgroundColor: '#1e1e1e', borderRadius: 24,
    padding: 28, width: '100%',
    borderWidth: 1, borderColor: '#333', alignItems: 'center'
  },
  emoji: { fontSize: 52, marginBottom: 12 },
  title: {
    fontSize: 22, fontWeight: 'bold', color: '#ffffff', marginBottom: 12
  },
  body: {
    color: '#aaaaaa', fontSize: 15, textAlign: 'center', lineHeight: 22
  },
  divider: {
    width: '100%', height: 1,
    backgroundColor: '#333', marginVertical: 20
  },
  completeBtn: {
    width: '100%', backgroundColor: '#4ade80',
    padding: 16, borderRadius: 14, alignItems: 'center', marginBottom: 10
  },
  completeBtnText: { fontSize: 16, fontWeight: 'bold', color: '#000000' },
  dismissBtn: {
    width: '100%', padding: 14,
    borderRadius: 14, alignItems: 'center',
    borderWidth: 1, borderColor: '#333'
  },
  dismissBtnText: { color: '#aaaaaa', fontSize: 15 },
});