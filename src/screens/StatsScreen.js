import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet,
  TouchableOpacity, Dimensions
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LineChart } from 'react-native-chart-kit';
import { getStreakData, getWeightLog, addWeightEntry, deleteWeightEntry } from '../services/localStore';
import { getMedalsStatus } from '../services/progressStore';
import { useI18n } from '../i18n/I18nContext';
import WeightModal from '../components/WeightModal';
import MedalsWall from '../components/MedalsWall';

const screenWidth = Dimensions.get('window').width - 32;

// Short weekday names (Monday-first) in the given language.
function localizedWeekDays(lang) {
  try {
    const out = [];
    for (let i = 0; i < 7; i++) {
      // 2024-01-01 is a Monday
      out.push(new Date(2024, 0, 1 + i).toLocaleDateString(lang, { weekday: 'short' }));
    }
    return out;
  } catch {
    return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  }
}

export default function StatsScreen({ profile, activeTab }) {
  const { t, lang } = useI18n();
  const weekDayLabels = localizedWeekDays(lang);
  const [streak, setStreak] = useState({ current: 0, best: 0 });
  const [completedDays, setCompletedDays] = useState(0);
  const [totalExercises, setTotalExercises] = useState(0);
  const [weightLog, setWeightLog] = useState([]);
  const [showWeightModal, setShowWeightModal] = useState(false);
  const [workoutPlan, setWorkoutPlan] = useState([]);
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [medals, setMedals] = useState([]);

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

    setMedals(await getMedalsStatus());
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
    if (bmi < 18.5) return { label: 'stats.bmiUnder', color: '#3b82f6' };
    if (bmi < 25) return { label: 'stats.bmiNormal', color: '#4ade80' };
    if (bmi < 30) return { label: 'stats.bmiOver', color: '#f97316' };
    return { label: 'stats.bmiObese', color: '#ef4444' };
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
        {/* Weekday header */}
        <View style={styles.calWeekRow}>
          {weekDayLabels.map((wd, i) => (
            <Text key={i} style={styles.calWeekDay}>{wd}</Text>
          ))}
        </View>

        {/* Cells */}
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
            <Text style={styles.calLegendText}>{t('stats.legendComplete')}</Text>
          </View>
          <View style={styles.calLegendItem}>
            <View style={[styles.calLegendDot, { backgroundColor: '#ef4444' }]} />
            <Text style={styles.calLegendText}>{t('stats.legendMissed')}</Text>
          </View>
          <View style={styles.calLegendItem}>
            <View style={[styles.calLegendDot, { backgroundColor: '#22c55e' }]} />
            <Text style={styles.calLegendText}>{t('stats.legendRecovery')}</Text>
          </View>
          <View style={styles.calLegendItem}>
            <View style={[styles.calLegendDot, { borderWidth: 1.5, borderColor: '#f97316', backgroundColor: 'transparent' }]} />
            <Text style={styles.calLegendText}>{t('stats.legendToday')}</Text>
          </View>
        </View>
      </View>
    );
  };

  const bmiInfo = bmi ? getBmiInfo(parseFloat(bmi)) : null;
  const hasWeightData = weightLog.length >= 1;
  const monthName = calendarMonth.toLocaleDateString(lang, { month: 'long', year: 'numeric' });

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>{t('stats.title')}</Text>

      {/* BMI */}
      {bmi && (
        <View style={styles.bmiCard}>
          <Text style={styles.cardLabel}>{t('stats.bmi')}</Text>
          <Text style={[styles.bmiNumber, { color: bmiInfo.color }]}>{bmi}</Text>
          <Text style={[styles.bmiLabel, { color: bmiInfo.color }]}>{t(bmiInfo.label)}</Text>
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
          <Text style={styles.statLabel}>{t('stats.streak')}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statEmoji}>🏆</Text>
          <Text style={styles.statNumber}>{streak.best}</Text>
          <Text style={styles.statLabel}>{t('stats.bestStreak')}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statEmoji}>📅</Text>
          <Text style={styles.statNumber}>{completedDays}</Text>
          <Text style={styles.statLabel}>{t('stats.completedDays')}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statEmoji}>💪</Text>
          <Text style={styles.statNumber}>{totalExercises}</Text>
          <Text style={styles.statLabel}>{t('stats.exercisesDone')}</Text>
        </View>
      </View>

      {/* Medals */}
      <MedalsWall medals={medals} />

      {/* Progress */}
      <View style={styles.progressCard}>
        <Text style={styles.cardLabel}>{t('stats.planProgress')}</Text>
        <Text style={styles.progressText}>{t('stats.daysOf', { done: completedDays })}</Text>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${(completedDays / 30) * 100}%` }]} />
        </View>
        <Text style={styles.progressPct}>{t('stats.pctComplete', { pct: Math.round((completedDays / 30) * 100) })}</Text>
      </View>

      {/* History calendar */}
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

      {/* Weight chart */}
      <View style={styles.weightCard}>
        <View style={styles.weightHeader}>
          <Text style={styles.cardLabel}>{t('stats.weightTitle')}</Text>
          <TouchableOpacity style={styles.addWeightBtn} onPress={() => setShowWeightModal(true)}>
            <Text style={styles.addWeightBtnText}>{t('weight.add')}</Text>
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
          <Text style={styles.oneEntryText}>{t('stats.oneMore')}</Text>
        ) : (
          <View style={styles.emptyWeight}>
            <Text style={styles.emptyWeightText}>{t('stats.emptyWeight')}</Text>
            <TouchableOpacity style={styles.emptyWeightBtn} onPress={() => setShowWeightModal(true)}>
              <Text style={styles.emptyWeightBtnText}>{t('stats.logNow')}</Text>
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