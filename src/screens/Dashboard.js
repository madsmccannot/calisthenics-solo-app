import React, { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { generateWorkoutPlan } from '../services/geminiService';

export default function Dashboard({ profile, onStartWorkout }) {
  const [days, setDays] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadOrGeneratePlan();
  }, []);

  const loadOrGeneratePlan = async () => {
    try {
      const saved = await AsyncStorage.getItem('workoutPlan');
      if (saved) {
        setDays(JSON.parse(saved));
        setLoading(false);
        return;
      }
      await generateFullPlan();
    } catch (e) {
      console.error('Erro ao carregar plano:', e);
      setLoading(false);
    }
  };

  const generateFullPlan = async () => {
    setLoading(true);
    const plan = [];

    for (let i = 1; i <= 30; i++) {
      // Dias de recuperação a cada 7 dias
      if (i % 7 === 0) {
        plan.push({
          day_number: i,
          workout_type: 'Recovery',
          exercises: [],
          completed: false,
        });
      } else {
        const workout = await generateWorkoutPlan(profile, i);
        if (workout) {
          plan.push({ ...workout, completed: false });
        }
      }
    }

    await AsyncStorage.setItem('workoutPlan', JSON.stringify(plan));
    setDays(plan);
    setLoading(false);
  };

  const getCardStyle = (day) => {
    if (day.completed) return [styles.card, styles.cardCompleted];
    if (day.workout_type === 'Recovery') return [styles.card, styles.cardRecovery];
    return [styles.card];
  };

  const getTypeColor = (type) => {
    if (type === 'HIIT') return '#f97316';
    if (type === 'Strength') return '#3b82f6';
    if (type === 'Recovery') return '#22c55e';
    return '#aaaaaa';
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4ade80" />
        <Text style={styles.loadingText}>A gerar o teu plano de 30 dias...</Text>
        <Text style={styles.loadingSubtext}>Isto pode demorar 1-2 minutos</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>O teu Plano de 30 Dias</Text>
      <View style={styles.grid}>
        {days.map((day) => (
          <TouchableOpacity
            key={day.day_number}
            style={getCardStyle(day)}
            onPress={() => day.workout_type !== 'Recovery' && onStartWorkout(day)}
            disabled={day.workout_type === 'Recovery'}
          >
            <Text style={styles.dayNumber}>Dia {day.day_number}</Text>
            <Text style={[styles.dayType, { color: getTypeColor(day.workout_type) }]}>
              {day.workout_type}
            </Text>
            {day.completed && <Text style={styles.checkmark}>✓</Text>}
            {day.workout_type !== 'Recovery' && (
              <Text style={styles.exerciseCount}>
                {day.exercises?.length || 0} exercícios
              </Text>
            )}
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f0f', padding: 16 },
  title: { fontSize: 22, fontWeight: 'bold', color: '#ffffff', marginBottom: 20, marginTop: 40 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  card: {
    width: '30%', aspectRatio: 1, backgroundColor: '#1e1e1e',
    borderRadius: 12, padding: 8, justifyContent: 'center',
    alignItems: 'center', borderWidth: 1, borderColor: '#333'
  },
  cardCompleted: { borderColor: '#4ade80', backgroundColor: '#14532d' },
  cardRecovery: { borderColor: '#333', opacity: 0.5 },
  dayNumber: { fontSize: 12, color: '#aaaaaa', marginBottom: 4 },
  dayType: { fontSize: 11, fontWeight: 'bold', textAlign: 'center' },
  checkmark: { fontSize: 18, color: '#4ade80', marginTop: 2 },
  exerciseCount: { fontSize: 10, color: '#666', marginTop: 2 },
  loadingContainer: { flex: 1, backgroundColor: '#0f0f0f', justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: '#ffffff', fontSize: 18, fontWeight: 'bold', marginTop: 20, textAlign: 'center' },
  loadingSubtext: { color: '#aaaaaa', fontSize: 14, marginTop: 8, textAlign: 'center' },
});