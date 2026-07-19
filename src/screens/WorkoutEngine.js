import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, Animated
} from 'react-native';
import { playBeep } from '../services/soundService';
import AnimationPlayer from '../components/AnimationPlayer';
import { xpForExercise } from '../config/xpTable';
import { useI18n } from '../i18n/I18nContext';

export default function WorkoutEngine({ workout, onComplete, onBack, className = 'Iniciante' }) {
  const { t } = useI18n();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [phase, setPhase] = useState('exercise');
  const [timeLeft, setTimeLeft] = useState(null);
  const [isRunning, setIsRunning] = useState(false);
  const [earnedXp, setEarnedXp] = useState(0);
  const intervalRef = useRef(null);
  const progressAnim = useRef(new Animated.Value(1)).current;
  const currentIndexRef = useRef(0);

  const exercises = workout?.exercises || [];
  const current = exercises[currentIndex];
  const isLast = currentIndex === exercises.length - 1;
  // no current -> NOT time-based (otherwise the effect below reads current.quantity and crashes)
  const isTimeBased = !!current && current.type !== 'reps';
  const currentXp = current ? xpForExercise(current, className) : 0;

  useEffect(() => {
    currentIndexRef.current = currentIndex;
  }, [currentIndex]);

  useEffect(() => {
    return () => clearInterval(intervalRef.current);
  }, []);

  useEffect(() => {
    if (!current) return; // day with no exercises -> do nothing
    if (phase === 'rest') {
      startTimer(current.rest_seconds, true);
    } else {
      setIsRunning(false);
      clearInterval(intervalRef.current);
      if (isTimeBased) {
        setTimeLeft(current.quantity);
      } else {
        setTimeLeft(null);
      }
    }
  }, [phase, currentIndex]);

  const goToNext = () => {
    const idx = currentIndexRef.current;
    const last = idx === exercises.length - 1;
    // credit the XP of the exercise just completed
    setEarnedXp((prev) => prev + xpForExercise(exercises[idx], className));
    if (last) {
      playBeep();
      setTimeout(() => playBeep(), 400);
      onComplete();
    } else {
      setCurrentIndex(idx + 1);
      setPhase('exercise');
    }
  };

  const startTimer = (seconds, isRestPhase = false) => {
    clearInterval(intervalRef.current);
    setTimeLeft(seconds);
    setIsRunning(true);

    progressAnim.setValue(1);
    Animated.timing(progressAnim, {
      toValue: 0,
      duration: seconds * 1000,
      useNativeDriver: false,
    }).start();

    intervalRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(intervalRef.current);
          setIsRunning(false);
          playBeep();
          if (isRestPhase) {
            goToNext();
          } else {
            const cur = exercises[currentIndexRef.current];
            if (cur.rest_seconds > 0) {
              setPhase('rest');
            } else {
              goToNext();
            }
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleExerciseDone = () => {
    if (isTimeBased) {
      if (!isRunning) {
        startTimer(current.quantity, false);
      } else {
        clearInterval(intervalRef.current);
        setIsRunning(false);
        playBeep();
        if (current.rest_seconds > 0) {
          setPhase('rest');
        } else {
          goToNext();
        }
      }
      return;
    }
    playBeep();
    if (current.rest_seconds > 0) {
      setPhase('rest');
    } else {
      goToNext();
    }
  };

  const skipRest = () => {
    clearInterval(intervalRef.current);
    setIsRunning(false);
    goToNext();
  };

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  if (!current) return null;

  const getButtonLabel = () => {
    if (isTimeBased) {
      if (isRunning) return t('workout.skip');
      return isLast ? t('workout.finish') : t('workout.start');
    }
    return isLast ? t('workout.finish') : t('workout.done');
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack}>
          <Text style={styles.backBtn}>{t('workout.exit')}</Text>
        </TouchableOpacity>
        <View style={styles.headerRight}>
          <Text style={styles.xpCounter}>⚡ {earnedXp} XP</Text>
          <Text style={styles.progress}>
            {currentIndex + 1} / {exercises.length}
          </Text>
        </View>
      </View>

      <View style={styles.overallBar}>
        <View style={[styles.overallFill, {
          width: `${(currentIndex / exercises.length) * 100}%`
        }]} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {phase === 'exercise' ? (
          <>
            <View style={styles.exerciseCard}>
              <View style={styles.cardTopRow}>
                <Text style={styles.workoutType}>{workout.workout_type}</Text>
                <View style={styles.xpBadge}>
                  <Text style={styles.xpBadgeText}>+{currentXp} XP</Text>
                </View>
              </View>
              <AnimationPlayer animationFile={current.animation_file} />
              <Text style={styles.exerciseName}>{current.display_name}</Text>
              <View style={styles.quantityBox}>
                {current.type === 'reps' ? (
                  <>
                    <Text style={styles.quantityNumber}>{current.quantity}</Text>
                    <Text style={styles.quantityLabel}>{t('workout.repetitions')}</Text>
                  </>
                ) : (
                  <>
                    <Text style={styles.quantityNumber}>
                      {isRunning ? timeLeft : current.quantity}
                    </Text>
                    <Text style={styles.quantityLabel}>{t('workout.seconds')}</Text>
                  </>
                )}
              </View>
              {isTimeBased && isRunning && (
                <View style={styles.timerBarContainer}>
                  <Animated.View style={[styles.timerBarFill, { width: progressWidth }]} />
                </View>
              )}
            </View>

            <Text style={styles.upNextLabel}>{t('workout.upNext')}</Text>
            {exercises.slice(currentIndex + 1, currentIndex + 4).map((ex, i) => (
              <View key={i} style={styles.upNextItem}>
                <Text style={styles.upNextDot}>·</Text>
                <Text style={styles.upNextName}>{ex.display_name}</Text>
                <Text style={styles.upNextQty}>
                  {ex.quantity} {ex.type === 'reps' ? t('workout.reps') : t('workout.sec')}
                </Text>
              </View>
            ))}

            <TouchableOpacity style={styles.doneBtn} onPress={handleExerciseDone}>
              <Text style={styles.doneBtnText}>{getButtonLabel()}</Text>
            </TouchableOpacity>
          </>
        ) : (
          <View style={styles.restContainer}>
            <Text style={styles.restTitle}>{t('workout.rest')}</Text>
            <Text style={styles.restTimer}>{timeLeft}s</Text>
            <View style={styles.timerBarContainer}>
              <Animated.View style={[styles.timerBarFill, { width: progressWidth }]} />
            </View>
            <Text style={styles.nextUpLabel}>{t('workout.next')}</Text>
            <Text style={styles.nextExercise}>
              {isLast ? t('workout.end') : exercises[currentIndex + 1]?.display_name}
            </Text>
            <TouchableOpacity style={styles.skipBtn} onPress={skipRest}>
              <Text style={styles.skipBtnText}>{t('workout.skipRest')}</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f0f' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', padding: 20, paddingTop: 50
  },
  backBtn: { color: '#aaaaaa', fontSize: 16 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  xpCounter: { color: '#fbbf24', fontSize: 14, fontWeight: 'bold' },
  progress: { color: '#aaaaaa', fontSize: 14 },
  overallBar: {
    height: 4, backgroundColor: '#1e1e1e', marginHorizontal: 20, borderRadius: 2
  },
  overallFill: { height: 4, backgroundColor: '#4ade80', borderRadius: 2 },
  content: { padding: 20, paddingBottom: 40 },
  exerciseCard: {
    backgroundColor: '#1e1e1e', borderRadius: 20, padding: 24,
    alignItems: 'center', marginBottom: 24, borderWidth: 1, borderColor: '#333'
  },
  cardTopRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    width: '100%', marginBottom: 8
  },
  workoutType: { color: '#f97316', fontSize: 12, fontWeight: 'bold' },
  xpBadge: {
    backgroundColor: '#0f0f0f', borderWidth: 1, borderColor: '#fbbf24',
    borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3
  },
  xpBadgeText: { color: '#fbbf24', fontSize: 12, fontWeight: 'bold' },
  exerciseName: {
    color: '#ffffff', fontSize: 28, fontWeight: 'bold',
    textAlign: 'center', marginBottom: 24
  },
  quantityBox: { alignItems: 'center', marginBottom: 16 },
  quantityNumber: { color: '#4ade80', fontSize: 64, fontWeight: 'bold' },
  quantityLabel: { color: '#aaaaaa', fontSize: 16 },
  timerBarContainer: {
    width: '100%', height: 6, backgroundColor: '#333',
    borderRadius: 3, marginTop: 16, overflow: 'hidden'
  },
  timerBarFill: { height: 6, backgroundColor: '#4ade80', borderRadius: 3 },
  upNextLabel: { color: '#aaaaaa', fontSize: 14, marginBottom: 10 },
  upNextItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#1e1e1e'
  },
  upNextDot: { color: '#4ade80', fontSize: 20, marginRight: 10 },
  upNextName: { color: '#ffffff', fontSize: 15, flex: 1 },
  upNextQty: { color: '#aaaaaa', fontSize: 13 },
  doneBtn: {
    marginTop: 32, backgroundColor: '#4ade80', padding: 18,
    borderRadius: 16, alignItems: 'center'
  },
  doneBtnText: { fontSize: 18, fontWeight: 'bold', color: '#000000' },
  restContainer: { flex: 1, alignItems: 'center', paddingTop: 60 },
  restTitle: { color: '#aaaaaa', fontSize: 20, marginBottom: 16 },
  restTimer: { color: '#4ade80', fontSize: 96, fontWeight: 'bold' },
  nextUpLabel: { color: '#aaaaaa', fontSize: 16, marginTop: 32 },
  nextExercise: {
    color: '#ffffff', fontSize: 22, fontWeight: 'bold',
    marginTop: 8, textAlign: 'center'
  },
  skipBtn: {
    marginTop: 40, borderWidth: 1, borderColor: '#333',
    padding: 14, borderRadius: 12
  },
  skipBtnText: { color: '#aaaaaa', fontSize: 16 },
});