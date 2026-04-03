import React, { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { generateWorkoutPlan } from '../services/geminiService';
import { getStreakData, updateStreak } from '../services/localStore';
import RecoveryModal from '../components/RecoveryModal';

export default function Dashboard({ profile, onStartWorkout }) {
  const [days, setDays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [streak, setStreak] = useState({ current: 0, best: 0 });
  const [recoveryDay, setRecoveryDay] = useState(null);

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    const streakData = await getStreakData();
    setStreak(streakData);

    let start = await AsyncStorage.getItem('planStartDate');
    if (!start) {
      start = new Date().toISOString();
      await AsyncStorage.setItem('planStartDate', start);
    }

    const saved = await AsyncStorage.getItem('workoutPlan');
    if (saved) {
      setDays(JSON.parse(saved));
      setLoading(false);
      return;
    }

    const startD = new Date(start);
    startD.setHours(0, 0, 0, 0);
    await generateFullPlan(startD);
  };

  const generateFullPlan = async (startD) => {
    setLoading(true);
    const plan = [];
    for (let i = 1; i <= 30; i++) {
      const date = new Date(startD);
      date.setDate(startD.getDate() + i - 1);
      if (i % 7 === 0) {
        plan.push({
          day_number: i,
          date: date.toISOString(),
          workout_type: 'Recovery',
          exercises: [],
          completed: false,
        });
      } else {
        const workout = await generateWorkoutPlan(profile, i);
        if (workout) {
          plan.push({ ...workout, date: date.toISOString(), completed: false });
        }
      }
    }
    await AsyncStorage.setItem('workoutPlan', JSON.stringify(plan));
    setDays(plan);
    setLoading(false);
  };

  const handleRecoveryDone = async () => {
    if (!recoveryDay) return;
    const saved = await AsyncStorage.getItem('workoutPlan');
    if (saved) {
      const plan = JSON.parse(saved);
      const updated = plan.map((d) =>
        d.day_number === recoveryDay.day_number ? { ...d, completed: true } : d
      );
      await AsyncStorage.setItem('workoutPlan', JSON.stringify(updated));
      setDays(updated);
    }
    const streakData = await updateStreak();
    setStreak(streakData);
    setRecoveryDay(null);
  };

  const getCardStyle = (day) => {
    if (day.completed) return [styles.card, styles.cardCompleted];
    if (day.workout_type === 'Recovery') return [styles.card, styles.cardRecovery];

    // Dia passado não completo
    if (day.date) {
      const d = new Date(day.date);
      d.setHours(0, 0, 0, 0);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (d < today) return [styles.card, styles.cardMissed];

      // Hoje
      if (d.getTime() === today.getTime()) return [styles.card, styles.cardToday];
    }

    return [styles.card];
  };

  const getTypeColor = (type) => {
    if (type === 'HIIT') return '#f97316';
    if (type === 'Strength') return '#3b82f6';
    if (type === 'Recovery') return '#22c55e';
    return '#aaaaaa';
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit' });
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
    <>
      <ScrollView style={styles.container}>
        <Text style={styles.title}>O teu Plano de 30 Dias</Text>
        <View style={styles.streakBanner}>
          <Text style={styles.streakFire}>🔥</Text>
          <View>
            <Text style={styles.streakCurrent}>{streak.current} dias seguidos</Text>
            <Text style={styles.streakBest}>Melhor: {streak.best} dias</Text>
          </View>
        </View>
        <View style={styles.grid}>
          {days.map((day) => (
            <TouchableOpacity
              key={day.day_number}
              style={getCardStyle(day)}
              onPress={() => {
                if (day.workout_type === 'Recovery') {
                  setRecoveryDay(day);
                  return;
                }
                onStartWorkout(day);
              }}
            >
              <Text style={styles.dayDate}>{formatDate(day.date)}</Text>
              <Text style={styles.dayNumber}>Dia {day.day_number}</Text>
              <Text style={[styles.dayType, { color: getTypeColor(day.workout_type) }]}>
                {day.workout_type}
              </Text>
              {day.completed && <Text style={styles.checkmark}>✓</Text>}
              {day.workout_type !== 'Recovery' && !day.completed && (
                <Text style={styles.exerciseCount}>
                  {day.exercises?.length || 0} exercícios
                </Text>
              )}
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      <RecoveryModal
        visible={!!recoveryDay}
        onDismiss={() => setRecoveryDay(null)}
        onComplete={handleRecoveryDone}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f0f', padding: 16 },
  title: { fontSize: 22, fontWeight: 'bold', color: '#ffffff', marginBottom: 20, marginTop: 40 },
  loadingContainer: { flex: 1, backgroundColor: '#0f0f0f', justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: '#ffffff', fontSize: 18, fontWeight: 'bold', marginTop: 20, textAlign: 'center' },
  loadingSubtext: { color: '#aaaaaa', fontSize: 14, marginTop: 8, textAlign: 'center' },
  streakBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 16,
    backgroundColor: '#1e1e1e', borderRadius: 14, padding: 16,
    marginBottom: 20, borderWidth: 1, borderColor: '#f97316'
  },
  streakFire: { fontSize: 36 },
  streakCurrent: { color: '#ffffff', fontSize: 18, fontWeight: 'bold' },
  streakBest: { color: '#aaaaaa', fontSize: 13, marginTop: 2 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  card: {
    width: '30%', aspectRatio: 0.9, backgroundColor: '#1e1e1e',
    borderRadius: 12, padding: 8, justifyContent: 'center',
    alignItems: 'center', borderWidth: 1, borderColor: '#333'
  },
  cardCompleted: { borderColor: '#4ade80', backgroundColor: '#14532d' },
  cardRecovery: { borderColor: '#333', opacity: 0.5 },
  cardMissed: { borderColor: '#7f1d1d', backgroundColor: '#2a1a1a' },
  cardToday: { borderColor: '#f97316', borderWidth: 2 },
  dayDate: { fontSize: 9, color: '#666', marginBottom: 2 },
  dayNumber: { fontSize: 11, color: '#aaaaaa', marginBottom: 2 },
  dayType: { fontSize: 10, fontWeight: 'bold', textAlign: 'center' },
  checkmark: { fontSize: 16, color: '#4ade80', marginTop: 2 },
  exerciseCount: { fontSize: 9, color: '#666', marginTop: 2 },
});