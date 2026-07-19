import React, { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getStreakData, updateStreak, getWeightLog } from '../services/localStore';
import { getProgressSummary, rewardRecovery, markWorkoutMissionForToday, checkMedals, getSeason, seasonTier } from '../services/progressStore';
import { generateSeasonPlan } from '../services/planService';
import { RECOVERY_XP } from '../config/xpTable';
import { colors } from '../theme';
import { useI18n } from '../i18n/I18nContext';
import RecoveryModal from '../components/RecoveryModal';
import LevelHeader from '../components/LevelHeader';
import MissionCard from '../components/MissionCard';
import InfoModal from '../components/InfoModal';

export default function Dashboard({ profile, onStartWorkout }) {
  const { t } = useI18n();
  const [days, setDays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [streak, setStreak] = useState({ current: 0, best: 0 });
  const [recoveryDay, setRecoveryDay] = useState(null);
  const [summary, setSummary] = useState(null);
  const [missionKey, setMissionKey] = useState(0);
  const [emptyDayInfo, setEmptyDayInfo] = useState(false);
  const [season, setSeason] = useState(1);

  useEffect(() => {
    loadAll();
  }, []);

  const refreshProgress = async () => {
    setSummary(await getProgressSummary());
  };

  const loadAll = async () => {
    const streakData = await getStreakData();
    setStreak(streakData);
    await refreshProgress();
    const s = await getSeason();
    setSeason(s);

    const saved = await AsyncStorage.getItem('workoutPlan');
    if (saved) {
      const parsed = JSON.parse(saved);
      // Repara planos com day_number duplicado (bug antigo da regeneração):
      // a ordem do array é a verdade, por isso re-derivamos o número pela posição.
      // Também garante que exercises é sempre um array.
      const normalized = parsed.map((d, i) => ({
        ...d,
        day_number: i + 1,
        exercises: Array.isArray(d.exercises) ? d.exercises : [],
      }));
      const needsFix = parsed.some(
        (d, i) => d.day_number !== i + 1 || !Array.isArray(d.exercises)
      );
      if (needsFix) await AsyncStorage.setItem('workoutPlan', JSON.stringify(normalized));
      setDays(normalized);
      setLoading(false);
      return;
    }

    // sem plano -> gera a season atual, ancorada a hoje
    setLoading(true);
    setGenerating(true);
    const plan = await generateSeasonPlan(profile, s, new Date());
    setDays(plan);
    setGenerating(false);
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

    // Recuperação também dá um pouco de XP e conta a missão de treino do dia
    await rewardRecovery(RECOVERY_XP);
    await markWorkoutMissionForToday();
    const weightLog = await getWeightLog();
    await checkMedals({ streak: streakData, weightLog });
    await refreshProgress();
    setMissionKey((k) => k + 1);

    setRecoveryDay(null);
  };

  const handleMissionClaimed = async () => {
    const sd = await getStreakData();
    const weightLog = await getWeightLog();
    await checkMedals({ streak: sd, weightLog });
    await refreshProgress();
  };

  // O "dia atual" é o primeiro por fazer (não de recuperação). Como o plano é
  // ao teu ritmo, não há dias "falhados" — só concluídos, atual e por fazer.
  const currentDay = days.find((d) => !d.completed && d.workout_type !== 'Recovery');

  const getCardStyle = (day) => {
    if (day.completed) return [styles.card, styles.cardCompleted];
    if (day.workout_type === 'Recovery') return [styles.card, styles.cardRecovery];
    if (currentDay && day.day_number === currentDay.day_number) {
      return [styles.card, styles.cardToday];
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
        {generating && (
          <>
            <Text style={styles.loadingText}>{t('dashboard.generating')}</Text>
            <Text style={styles.loadingSubtext}>{t('dashboard.generatingSub')}</Text>
          </>
        )}
      </View>
    );
  }

  return (
    <>
      <ScrollView style={styles.container}>
        <View style={styles.topSpacer} />
        <LevelHeader summary={summary} streak={streak.current} />
        <MissionCard
          key={missionKey}
          onClaimed={handleMissionClaimed}
        />

        {(() => {
          const nonRec = days.filter((d) => d.workout_type !== 'Recovery');
          const done = nonRec.filter((d) => d.completed).length;
          const total = nonRec.length || 1;
          const tier = seasonTier(season);
          return (
            <View style={styles.seasonCard}>
              <View style={styles.seasonHeader}>
                <View>
                  <Text style={styles.seasonName}>{t('dashboard.season')} {season}</Text>
                  {tier && <Text style={styles.seasonTier}>{t(tier)}</Text>}
                </View>
                <Text style={styles.seasonCount}>{t('dashboard.daysCount', { done, total })}</Text>
              </View>
              <View style={styles.seasonBar}>
                <View style={[styles.seasonFill, { width: `${(done / total) * 100}%` }]} />
              </View>
            </View>
          );
        })()}

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
                if (!day.exercises || day.exercises.length === 0) {
                  setEmptyDayInfo(true);
                  return;
                }
                onStartWorkout(day);
              }}
            >
              <Text style={styles.dayDate}>{formatDate(day.date)}</Text>
              <Text style={styles.dayNumber}>{t('dashboard.day')} {day.day_number}</Text>
              <Text style={[styles.dayType, { color: getTypeColor(day.workout_type) }]}>
                {day.workout_type}
              </Text>
              {day.completed && <Text style={styles.checkmark}>✓</Text>}
              {day.workout_type !== 'Recovery' && !day.completed && (
                <Text style={styles.exerciseCount}>
                  {day.exercises?.length || 0} {t('dashboard.exercises')}
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

      <InfoModal
        visible={emptyDayInfo}
        emoji="🛠️"
        title={t('dashboard.emptyTitle')}
        message={t('dashboard.emptyMsg')}
        buttonText={t('common.understood')}
        onDismiss={() => setEmptyDayInfo(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f0f', padding: 16 },
  topSpacer: { height: 40 },
  title: { fontSize: 18, fontWeight: 'bold', color: '#ffffff', marginBottom: 14, marginTop: 4 },
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
  seasonCard: {
    backgroundColor: '#1e1e1e', borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: '#333', marginBottom: 16
  },
  seasonHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12
  },
  seasonName: { color: '#ffffff', fontSize: 18, fontWeight: 'bold' },
  seasonTier: { color: '#a78bfa', fontSize: 12, fontWeight: 'bold', marginTop: 2 },
  seasonCount: { color: '#aaaaaa', fontSize: 14 },
  seasonBar: {
    height: 10, backgroundColor: '#0f0f0f', borderRadius: 5, overflow: 'hidden',
    borderWidth: 1, borderColor: '#333'
  },
  seasonFill: { height: '100%', backgroundColor: '#4ade80', borderRadius: 5 },
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