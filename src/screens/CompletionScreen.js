import React, { useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Animated
} from 'react-native';

export default function CompletionScreen({ workout, streak, onBack }) {
  const scaleAnim = useRef(new Animated.Value(0)).start;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const bounceAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.timing(fadeAnim, {
        toValue: 1, duration: 500, useNativeDriver: true
      }),
      Animated.spring(bounceAnim, {
        toValue: 1, friction: 3, tension: 40, useNativeDriver: true
      }),
    ]).start();
  }, []);

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.content, { opacity: fadeAnim }]}>

        {/* Emoji animado */}
        <Animated.Text style={[styles.trophy, {
          transform: [{ scale: bounceAnim }]
        }]}>
          🏆
        </Animated.Text>

        <Text style={styles.title}>Treino Concluído!</Text>
        <Text style={styles.subtitle}>Dia {workout.day_number} completo</Text>

        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>{workout.exercises.length}</Text>
            <Text style={styles.statLabel}>Exercícios</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>🔥 {streak}</Text>
            <Text style={styles.statLabel}>Dias seguidos</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>{workout.workout_type}</Text>
            <Text style={styles.statLabel}>Tipo</Text>
          </View>
        </View>

        {/* Mensagem motivacional */}
        <View style={styles.messageBox}>
          <Text style={styles.message}>
            {streak >= 7
              ? '🔥 Uma semana sem falhar! Continua assim!'
              : streak >= 3
              ? '💪 Estás a criar um hábito. Não pares!'
              : '✅ Bom trabalho! Volta amanhã para manter o streak.'}
          </Text>
        </View>

        <TouchableOpacity style={styles.backBtn} onPress={onBack}>
          <Text style={styles.backBtnText}>Ver o meu Plano →</Text>
        </TouchableOpacity>

      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1, backgroundColor: '#0f0f0f',
    justifyContent: 'center', alignItems: 'center'
  },
  content: { alignItems: 'center', padding: 24, width: '100%' },
  trophy: { fontSize: 80, marginBottom: 16 },
  title: {
    fontSize: 32, fontWeight: 'bold', color: '#ffffff', marginBottom: 8
  },
  subtitle: { fontSize: 18, color: '#4ade80', marginBottom: 32 },
  statsRow: {
    flexDirection: 'row', gap: 12, marginBottom: 24, width: '100%'
  },
  statBox: {
    flex: 1, backgroundColor: '#1e1e1e', borderRadius: 14,
    padding: 16, alignItems: 'center', borderWidth: 1, borderColor: '#333'
  },
  statNumber: { fontSize: 18, fontWeight: 'bold', color: '#ffffff', marginBottom: 4 },
  statLabel: { fontSize: 11, color: '#aaaaaa', textAlign: 'center' },
  messageBox: {
    backgroundColor: '#1e1e1e', borderRadius: 14, padding: 20,
    marginBottom: 32, borderWidth: 1, borderColor: '#4ade80', width: '100%'
  },
  message: { color: '#ffffff', fontSize: 16, textAlign: 'center', lineHeight: 24 },
  backBtn: {
    backgroundColor: '#4ade80', padding: 18,
    borderRadius: 16, alignItems: 'center', width: '100%'
  },
  backBtnText: { fontSize: 18, fontWeight: 'bold', color: '#000000' },
});