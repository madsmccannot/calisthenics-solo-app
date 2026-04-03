import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet,
  TouchableOpacity, Dimensions
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LineChart } from 'react-native-chart-kit';
import { getStreakData, getWeightLog, addWeightEntry, deleteWeightEntry } from '../services/localStore';
import WeightModal from '../components/WeightModal';

const screenWidth = Dimensions.get('window').width - 32;
const WEEK_DAYS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

export default function StatsScreen({ profile, activeTab }) {
  const [streak, setStreak] = useState({ current: 0, best: 0 });
  const [completedDays, setCompletedDays] = useState(0);
  const [totalExercises, setTotalExercises] = useState(0);
  const [weightLog, setWeightLog] = useState([]);
  const [showWeightModal, setShowWeightModal] = useState(false);
  const [workoutPlan, setWorkoutPlan] = useState([]);
  const [calendarMonth, setCalendarMonth] = useState(new Date());

  useEffect(() => {
    if (activeTab === 'stats') {
      loadStats();
    }
  }, [activeTab]);

  const loadStats = async () => {
    const streakData = await getStreakData();
    setStreak(streakData);

    const saved = await AsyncStorage.getItem('workoutPlan');
    if (saved) {
      const plan = JSON.parse(saved);
      setWorkoutPlan(plan);
      const completed = plan.filter((d) => d.completed);
      setCompletedDays(completed.length);
      const exercises = completed.reduce((acc, d) => acc + (d.exercises?.length || 0), 0);
      setTotalExercises(exercises);
    }

    const log = await getWeightLog();
    setWeightLog(log);
  };

  const handleWeightSave = async (weight) => {
    setShowWeightModal(false);
    const updated = await addWeightEntry(weight);
    setWeightLog([...updated]);
  };

  const handleWeightDelete = async (entry) => {
    const updated = await deleteWeightEntry(entry);
    setWeightLog([...updated]);
  };

  const bmi = profile
    ? (parseFloat(profile.weight) / Math.pow(parseFloat(profile.height) / 100, 2)).toFixed(1)
    : null;

  const getBmiInfo = (bmi) => {
    if (bmi < 18.5) return { label: 'Abaixo do peso', color: '#3b82f6' };
    if (bmi < 25) return { label: 'Peso normal', color: '#4ade80' };
    if (bmi < 30) return { label: 'Excesso de peso', color: '#f97316' };
    return { label: 'Obesidade', color: '#ef4444' };
  };

  const getBmiColor = (weight) => {
    if (!profile) return '#aaaaaa';
    const heightM = parseFloat(profile.height) / 100;
    const bmi = weight / (heightM * heightM);
    if (bmi < 18.5) return '#3b82f6';
    if (bmi < 25) return '#4ade80';
    if (bmi < 30) return '#f97316';
    return '#ef4444';
  };

  const getDayForDate = (date) => {
    return workoutPlan.find((d) => {
      if (!d.date) return false;
      const dd = new Date(d.date);
      return dd.getFullYear() === date.getFullYear() &&
        dd.getMonth() === date.getMonth() &&
        dd.getDate() === date.getDate();
    });
  };

  const renderCalendar = () => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

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
      <View>
        {/* Cabeçalho dias da semana */}
        <View style={styles.calWeekRow}>
          {WEEK_DAYS.map((wd) => (
            <Text key={wd} style={styles.calWeekDay}>{wd}</Text>
          ))}
        </View>

        {/* Células */}
        <View style={styles.calGrid}>
          {cells.map((date, i) => {
            if (!date) return <View key={`e-${i}`} style={styles.calEmpty} />;

            const planDay = getDayForDate(date);
            const isToday = date.getTime() === today.getTime();

            let bgColor = 'transparent';
            let borderColor = 'transparent';
            let dotColor = null;

            if (planDay?.completed) {
              dotColor = planDay.workout_type === 'Recovery' ? '#22c55e' : '#4ade80';
            } else if (planDay && date < today) {
              dotColor = '#ef4444';
            } else if (planDay && isToday) {
              borderColor = '#f97316';
            } else if (planDay && date > today) {
              dotColor = '#1D1D1D';
            }

            return (
              <View key={i} style={[styles.calCell, { borderColor, borderWidth: isToday ? 1.5 : 0 }]}>
                <Text style={[styles.calDate, {
                  color: isToday ? '#f97316' : planDay ? '#ffffff' : '#555'
                }]}>
                  {date.getDate()}
                </Text>
                {dotColor && (
                  <View style={[styles.calDot, { backgroundColor: dotColor }]} />
                )}
              </View>
            );
          })}
        </View>

        {/* Legenda */}
        <View style={styles.calLegend}>
          <View style={styles.calLegendItem}>
            <View style={[styles.calLegendDot, { backgroundColor: '#4ade80' }]} />
            <Text style={styles.calLegendText}>Completo</Text>
          </View>
          <View style={styles.calLegendItem}>
            <View style={[styles.calLegendDot, { backgroundColor: '#ef4444' }]} />
            <Text style={styles.calLegendText}>Falhado</Text>
          </View>
          <View style={styles.calLegendItem}>
            <View style={[styles.calLegendDot, { backgroundColor: '#22c55e' }]} />
            <Text style={styles.calLegendText}>Recovery</Text>
          </View>
          <View style={styles.calLegendItem}>
            <View style={[styles.calLegendDot, { borderWidth: 1.5, borderColor: '#f97316', backgroundColor: 'transparent' }]} />
            <Text style={styles.calLegendText}>Hoje</Text>
          </View>
        </View>
      </View>
    );
  };

  const bmiInfo = bmi ? getBmiInfo(parseFloat(bmi)) : null;
  const hasWeightData = weightLog.length >= 1;
  const monthName = calendarMonth.toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' });

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

      {/* Progresso */}
      <View style={styles.progressCard}>
        <Text style={styles.cardLabel}>Progresso do Plano</Text>
        <Text style={styles.progressText}>{completedDays} / 30 dias</Text>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${(completedDays / 30) * 100}%` }]} />
        </View>
        <Text style={styles.progressPct}>{Math.round((completedDays / 30) * 100)}% concluído</Text>
      </View>

      {/* Calendário histórico */}
      <View style={styles.calCard}>
        <View style={styles.calHeader}>
          <TouchableOpacity onPress={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1))}>
            <Text style={styles.calArrow}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.calMonthName}>{monthName}</Text>
          <TouchableOpacity onPress={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1))}>
            <Text style={styles.calArrow}>›</Text>
          </TouchableOpacity>
        </View>
        {renderCalendar()}
      </View>

      {/* Gráfico de peso */}
      <View style={styles.weightCard}>
        <View style={styles.weightHeader}>
          <Text style={styles.cardLabel}>Evolução do Peso</Text>
          <TouchableOpacity style={styles.addWeightBtn} onPress={() => setShowWeightModal(true)}>
            <Text style={styles.addWeightBtnText}>+ Registar</Text>
          </TouchableOpacity>
        </View>

        {hasWeightData && weightLog.length >= 2 ? (
          <>
            <LineChart
              data={{
                labels: weightLog.map((e) => e.date),
                datasets: [{ data: weightLog.map((e) => e.weight) }],
              }}
              width={screenWidth - 32}
              height={180}
              chartConfig={{
                backgroundColor: '#1e1e1e',
                backgroundGradientFrom: '#1e1e1e',
                backgroundGradientTo: '#1e1e1e',
                decimalPlaces: 1,
                color: (opacity = 1) => `rgba(74, 222, 128, ${opacity})`,
                labelColor: () => '#aaaaaa',
                propsForDots: { r: '6', strokeWidth: '2', stroke: '#1e1e1e' },
                propsForBackgroundLines: { stroke: '#2a2a2a' },
              }}
              getDotColor={(dataPoint) => getBmiColor(dataPoint)}
              bezier
              style={{ borderRadius: 12, marginTop: 12 }}
            />
          </>
        ) : hasWeightData ? (
          <Text style={styles.oneEntryText}>Regista mais um peso para ver o gráfico.</Text>
        ) : (
          <View style={styles.emptyWeight}>
            <Text style={styles.emptyWeightText}>
              Regista o teu peso para ver a evolução ao longo do tempo.
            </Text>
            <TouchableOpacity style={styles.emptyWeightBtn} onPress={() => setShowWeightModal(true)}>
              <Text style={styles.emptyWeightBtnText}>Registar agora</Text>
            </TouchableOpacity>
          </View>
        )}

        {hasWeightData && (
          <View style={styles.weightEntries}>
            {[...weightLog].reverse().slice(0, 3).map((e, i) => (
              <View key={i} style={styles.weightEntry}>
                <View style={[styles.entryDot, { backgroundColor: getBmiColor(e.weight) }]} />
                <Text style={styles.weightEntryDate}>{e.date}</Text>
                <Text style={[styles.weightEntryValue, { color: getBmiColor(e.weight) }]}>
                  {e.weight} kg
                </Text>
              </View>
            ))}
          </View>
        )}
      </View>

      <WeightModal
        visible={showWeightModal}
        onSave={handleWeightSave}
        onDelete={handleWeightDelete}
        onDismiss={() => setShowWeightModal(false)}
        entries={weightLog.map(e => ({ ...e, heightM: parseFloat(profile?.height) / 100 }))}
      />
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
    marginBottom: 16, borderWidth: 1, borderColor: '#333'
  },
  progressText: { color: '#ffffff', fontSize: 18, fontWeight: 'bold', marginBottom: 12 },
  progressBar: { width: '100%', height: 10, backgroundColor: '#333', borderRadius: 5, overflow: 'hidden', marginBottom: 8 },
  progressFill: { height: 10, backgroundColor: '#4ade80', borderRadius: 5 },
  progressPct: { color: '#aaaaaa', fontSize: 13 },
  calCard: {
    backgroundColor: '#1e1e1e', borderRadius: 16, padding: 16,
    marginBottom: 16, borderWidth: 1, borderColor: '#333'
  },
  calHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  calArrow: { color: '#ffffff', fontSize: 28, paddingHorizontal: 8 },
  calMonthName: { color: '#ffffff', fontSize: 16, fontWeight: 'bold', textTransform: 'capitalize' },
  calWeekRow: { flexDirection: 'row', marginBottom: 4 },
  calWeekDay: { flex: 1, textAlign: 'center', color: '#666', fontSize: 11, fontWeight: '600' },
  calGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  calCell: {
    width: '14.28%', aspectRatio: 1, alignItems: 'center',
    justifyContent: 'center', borderRadius: 6,
  },
  calEmpty: { width: '14.28%', aspectRatio: 1 },
  calDate: { fontSize: 13, fontWeight: '500' },
  calDot: { width: 5, height: 5, borderRadius: 3, marginTop: 2 },
  calLegend: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 12 },
  calLegendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  calLegendDot: { width: 8, height: 8, borderRadius: 4 },
  calLegendText: { color: '#aaaaaa', fontSize: 11 },
  weightCard: {
    backgroundColor: '#1e1e1e', borderRadius: 16, padding: 20,
    marginBottom: 32, borderWidth: 1, borderColor: '#333'
  },
  weightHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  addWeightBtn: { backgroundColor: '#4ade80', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  addWeightBtnText: { color: '#000000', fontWeight: 'bold', fontSize: 13 },
  oneEntryText: { color: '#aaaaaa', fontSize: 13, marginTop: 12, textAlign: 'center' },
  weightEntries: { marginTop: 12 },
  weightEntry: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#2a2a2a', gap: 8 },
  entryDot: { width: 8, height: 8, borderRadius: 4 },
  weightEntryDate: { color: '#aaaaaa', fontSize: 13, flex: 1 },
  weightEntryValue: { fontSize: 13, fontWeight: 'bold' },
  emptyWeight: { alignItems: 'center', paddingVertical: 24 },
  emptyWeightText: { color: '#aaaaaa', fontSize: 14, textAlign: 'center', marginBottom: 16, lineHeight: 22 },
  emptyWeightBtn: { backgroundColor: '#4ade80', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 },
  emptyWeightBtnText: { color: '#000000', fontWeight: 'bold' },
});