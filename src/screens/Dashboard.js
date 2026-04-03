import React, { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { generateWorkoutPlan } from '../services/geminiService';
import { getStreakData, updateStreak } from '../services/localStore';
import RecoveryModal from '../components/RecoveryModal';

const WEEK_DAYS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

function getMonday(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1 - day);
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export default function Dashboard({ profile, onStartWorkout }) {
  const [days, setDays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [streak, setStreak] = useState({ current: 0, best: 0 });
  const [recoveryDay, setRecoveryDay] = useState(null);
  const [startDate, setStartDate] = useState(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());

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
    const startD = new Date(start);
    startD.setHours(0, 0, 0, 0);
    setStartDate(startD);
    setCurrentMonth(new Date(startD.getFullYear(), startD.getMonth(), 1));

    const saved = await AsyncStorage.getItem('workoutPlan');
    if (saved) {
      setDays(JSON.parse(saved));
      setLoading(false);
      return;
    }
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

  const getDayForDate = (date) => {
    return days.find((d) => {
      if (!d.date) return false;
      const dd = new Date(d.date);
      return dd.getFullYear() === date.getFullYear() &&
        dd.getMonth() === date.getMonth() &&
        dd.getDate() === date.getDate();
    });
  };

  const getTypeColor = (type) => {
    if (type === 'HIIT') return '#f97316';
    if (type === 'Strength') return '#3b82f6';
    if (type === 'Recovery') return '#22c55e';
    return '#aaaaaa';
  };

  const renderCalendar = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    // Offset para começar na segunda-feira
    let startOffset = firstDay.getDay() - 1;
    if (startOffset < 0) startOffset = 6;

    const cells = [];
    for (let i = 0; i < startOffset; i++) cells.push(null);
    for (let d = 1; d <= lastDay.getDate(); d++) {
      cells.push(new Date(year, month, d));
    }
    while (cells.length % 7 !== 0) cells.push(null);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return (
      <View style={styles.calendarGrid}>
        {WEEK_DAYS.map((wd) => (
          <Text key={wd} style={styles.weekDay}>{wd}</Text>
        ))}
        {cells.map((date, i) => {
          if (!date) return <View key={`empty-${i}`} style={styles.emptyCell} />;

          const planDay = getDayForDate(date);
          const isToday = date.getTime() === today.getTime();
          const isPast = date < today && !isToday;
          const isFuture = date > today;

          let bgColor = '#1e1e1e';
          let borderColor = '#333';
          let textColor = '#ffffff';

          if (planDay?.completed) {
            bgColor = '#14532d';
            borderColor = '#4ade80';
          } else if (planDay && isToday) {
            borderColor = '#f97316';
          } else if (planDay && isPast && !planDay.completed) {
            bgColor = '#2a1a1a';
            borderColor = '#7f1d1d';
          } else if (!planDay || isFuture) {
            textColor = '#555';
          }

          return (
            <TouchableOpacity
              key={i}
              style={[styles.cell, { backgroundColor: bgColor, borderColor }]}
              onPress={() => {
                if (!planDay) return;
                if (planDay.workout_type === 'Recovery') {
                  setRecoveryDay(planDay);
                  return;
                }
                onStartWorkout(planDay);
              }}
              disabled={!planDay}
            >
              <Text style={[styles.cellDate, { color: isToday ? '#f97316' : textColor }]}>
                {date.getDate()}
              </Text>
              {planDay && (
                <>
                  <Text style={[styles.cellPlanDay, { color: getTypeColor(planDay.workout_type) }]}>
                    D{planDay.day_number}
                  </Text>
                  {planDay.completed && <Text style={styles.cellCheck}>✓</Text>}
                </>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    );
  };

  const monthName = currentMonth.toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' });

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
        {/* Streak banner */}
        <View style={styles.streakBanner}>
          <Text style={styles.streakFire}>🔥</Text>
          <View>
            <Text style={styles.streakCurrent}>{streak.current} dias seguidos</Text>
            <Text style={styles.streakBest}>Melhor: {streak.best} dias</Text>
          </View>
        </View>

        {/* Navegação do mês */}
        <View style={styles.monthNav}>
          <TouchableOpacity
            onPress={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))}
          >
            <Text style={styles.monthArrow}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.monthName}>{monthName}</Text>
          <TouchableOpacity
            onPress={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))}
          >
            <Text style={styles.monthArrow}>›</Text>
          </TouchableOpacity>
        </View>

        {/* Calendário */}
        {renderCalendar()}

        {/* Legenda */}
        <View style={styles.legend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#4ade80' }]} />
            <Text style={styles.legendText}>Completo</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#f97316' }]} />
            <Text style={styles.legendText}>Hoje</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#7f1d1d' }]} />
            <Text style={styles.legendText}>Falhado</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#22c55e' }]} />
            <Text style={styles.legendText}>Recovery</Text>
          </View>
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
  loadingContainer: { flex: 1, backgroundColor: '#0f0f0f', justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: '#ffffff', fontSize: 18, fontWeight: 'bold', marginTop: 20, textAlign: 'center' },
  loadingSubtext: { color: '#aaaaaa', fontSize: 14, marginTop: 8, textAlign: 'center' },
  streakBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 16,
    backgroundColor: '#1e1e1e', borderRadius: 14, padding: 16,
    marginBottom: 16, marginTop: 40, borderWidth: 1, borderColor: '#f97316'
  },
  streakFire: { fontSize: 36 },
  streakCurrent: { color: '#ffffff', fontSize: 18, fontWeight: 'bold' },
  streakBest: { color: '#aaaaaa', fontSize: 13, marginTop: 2 },
  monthNav: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 12
  },
  monthArrow: { color: '#ffffff', fontSize: 32, paddingHorizontal: 12 },
  monthName: {
    color: '#ffffff', fontSize: 18, fontWeight: 'bold',
    textTransform: 'capitalize'
  },
  calendarGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 4
  },
  weekDay: {
    width: '13%', textAlign: 'center',
    color: '#aaaaaa', fontSize: 11, marginBottom: 4,
    fontWeight: '600'
  },
  cell: {
    width: '13%', aspectRatio: 0.85,
    borderRadius: 8, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
    padding: 2,
  },
  emptyCell: { width: '13%', aspectRatio: 0.85 },
  cellDate: { fontSize: 13, fontWeight: 'bold' },
  cellPlanDay: { fontSize: 9, fontWeight: 'bold', marginTop: 1 },
  cellCheck: { fontSize: 10, color: '#4ade80' },
  legend: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 12,
    marginTop: 16, marginBottom: 32
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { color: '#aaaaaa', fontSize: 12 },
});