import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getStreakData } from '../services/localStore';

export default function StatsScreen({ profile }) {
  const [streak, setStreak] = useState({ current: 0, best: 0 });
  const [completedDays, setCompletedDays] = useState(0);
  const [totalExercises, setTotalExercises] = useState(0);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    const streakData = await getStreakData();
    setStreak(streakData);

    const saved = await AsyncStorage.getItem('workoutPlan');
    if (saved) {
      const plan = JSON.parse(saved);
      const completed = plan.filter((d) => d.completed);
      setCompletedDays(completed.length);
      const exercises = completed.reduce((acc, d) => acc + (d.exercises?.length || 0), 0);
      setTotalExercises(exercises);
    }
  };

  const bmi = profile
    ? (parseFloat(profile.weight) / Math.pow(parseFloat(profile.height) / 100, 2)).toFixed(1)
    : null;

  const getBmiLabel = (bmi) => {
    if (bmi < 18.5) return { label: 'Abaixo do peso', color: '#3b82f6' };
    if (bmi < 25) return { label: 'Peso normal', color: '#4ade80' };
    if (bmi < 30) return { label: 'Excesso de peso', color: '#f97316' };
    return { label: 'Obesidade', color: '#ef4444' };
  };

  const bmiInfo = bmi ? getBmiLabel(parseFloat(bmi)) : null;

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>As minhas Estatísticas</Text>

      {/* IMC */}
      {bmi && (
        <View style={styles.bmiCard}>
          <Text style={styles.cardLabel}>Índice de Massa Corporal</Text>
          <Text style={[styles.bmiNumber, { color: bmiInfo.color }]}>{bmi}</Text>
          <Text style={[styles.bmiLabel, { color: bmiInfo.color }]}>{bmiInfo.label}</Text>
          <View style={styles.bmiBar}>
            <View style={[styles.bmiSegment, { backgroundColor: '#3b82f6' }]} />
            <View style={[styles.bmiSegment, { backgroundColor: '#4ade80' }]} />
            <View style={[styles.bmiSegment, { backgroundColor: '#f97316' }]} />
            <View style={[styles.bmiSegment, { backgroundColor: '#ef4444' }]} />
          </View>
          <View style={styles.bmiBarLabels}>
            <Text style={styles.bmiBarLabel}>{'<18.5'}</Text>
            <Text style={styles.bmiBarLabel}>18.5-25</Text>
            <Text style={styles.bmiBarLabel}>25-30</Text>
            <Text style={styles.bmiBarLabel}>{'>30'}</Text>
          </View>
          <Text style={styles.bmiSub}>
            {parseFloat(profile.weight)}kg · {parseFloat(profile.height)}cm
          </Text>
        </View>
      )}

      {/* Stats grid */}
      <View style={styles.statsGrid}>
        <View style={styles.statCard}>
          <Text style={styles.statEmoji}>🔥</Text>
          <Text style={styles.statNumber}>{streak.current}</Text>
          <Text style={styles.statLabel}>Streak atual</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statEmoji}>🏆</Text>
          <Text style={styles.statNumber}>{streak.best}</Text>
          <Text style={styles.statLabel}>Melhor streak</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statEmoji}>📅</Text>
          <Text style={styles.statNumber}>{completedDays}</Text>
          <Text style={styles.statLabel}>Dias completos</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statEmoji}>💪</Text>
          <Text style={styles.statNumber}>{totalExercises}</Text>
          <Text style={styles.statLabel}>Exercícios feitos</Text>
        </View>
      </View>

      {/* Progresso 30 dias */}
      <View style={styles.progressCard}>
        <Text style={styles.cardLabel}>Progresso do Plano</Text>
        <Text style={styles.progressText}>{completedDays} / 30 dias</Text>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, {
            width: `${(completedDays / 30) * 100}%`
          }]} />
        </View>
        <Text style={styles.progressPct}>
          {Math.round((completedDays / 30) * 100)}% concluído
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f0f', padding: 16 },
  title: { fontSize: 22, fontWeight: 'bold', color: '#ffffff', marginBottom: 20, marginTop: 40 },
  bmiCard: {
    backgroundColor: '#1e1e1e', borderRadius: 16, padding: 20,
    marginBottom: 16, borderWidth: 1, borderColor: '#333', alignItems: 'center'
  },
  cardLabel: { color: '#aaaaaa', fontSize: 13, marginBottom: 8 },
  bmiNumber: { fontSize: 56, fontWeight: 'bold' },
  bmiLabel: { fontSize: 18, fontWeight: 'bold', marginBottom: 16 },
  bmiBar: { flexDirection: 'row', width: '100%', height: 8, borderRadius: 4, overflow: 'hidden', marginBottom: 4 },
  bmiSegment: { flex: 1, marginHorizontal: 1 },
  bmiBarLabels: { flexDirection: 'row', width: '100%', justifyContent: 'space-between', marginBottom: 12 },
  bmiBarLabel: { color: '#666', fontSize: 10 },
  bmiSub: { color: '#aaaaaa', fontSize: 13 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  statCard: {
    width: '47%', backgroundColor: '#1e1e1e', borderRadius: 16,
    padding: 20, alignItems: 'center', borderWidth: 1, borderColor: '#333'
  },
  statEmoji: { fontSize: 28, marginBottom: 8 },
  statNumber: { fontSize: 32, fontWeight: 'bold', color: '#ffffff', marginBottom: 4 },
  statLabel: { color: '#aaaaaa', fontSize: 13, textAlign: 'center' },
  progressCard: {
    backgroundColor: '#1e1e1e', borderRadius: 16, padding: 20,
    marginBottom: 32, borderWidth: 1, borderColor: '#333'
  },
  progressText: { color: '#ffffff', fontSize: 18, fontWeight: 'bold', marginBottom: 12 },
  progressBar: {
    width: '100%', height: 10, backgroundColor: '#333',
    borderRadius: 5, overflow: 'hidden', marginBottom: 8
  },
  progressFill: { height: 10, backgroundColor: '#4ade80', borderRadius: 5 },
  progressPct: { color: '#aaaaaa', fontSize: 13 },
});