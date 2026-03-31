import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, Animated
} from 'react-native';
import { playBeep } from '../services/soundService';

export default function WorkoutEngine({ workout, onComplete, onBack }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [phase, setPhase] = useState('exercise'); // 'exercise' | 'rest'
  const [timeLeft, setTimeLeft] = useState(null);
  const [isRunning, setIsRunning] = useState(false);
  const intervalRef = useRef(null);
  const progressAnim = useRef(new Animated.Value(1)).current;

  const exercises = workout.exercises;
  const current = exercises[currentIndex];
  const isLast = currentIndex === exercises.length - 1;
  const isTimeBased = current?.type !== 'reps';

  useEffect(() => {
    return () => clearInterval(intervalRef.current);
  }, []);

  useEffect(() => {
    if (phase === 'rest') {
      startTimer(current.rest_seconds);
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

  const startTimer = (seconds) => {
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
          if (phase === 'rest') {
            playBeep();
            goToNext();
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleExerciseDone = () => {
    if (isTimeBased && !isRunning) {
      startTimer(current.quantity);
      return;
    }
    if (current.rest_seconds > 0) {
      playBeep();
      setPhase('rest');
    } else {
      goToNext();
    }
  };

  const goToNext = () => {
    if (isLast) {
      onComplete();
    } else {
      setCurrentIndex((i) => i + 1);
      setPhase('exercise');
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

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack}>
          <Text style={styles.backBtn}>← Sair</Text>
        </TouchableOpacity>
        <Text style={styles.progress}>
          {currentIndex + 1} / {exercises.length}
        </Text>
      </View>

      {/* Barra de progresso geral */}
      <View style={styles.overallBar}>
        <View style={[styles.overallFill, {
          width: `${((currentIndex) / exercises.length) * 100}%`
        }]} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {phase === 'exercise' ? (
          <>
            {/* Card do exercício */}
            <View style={styles.exerciseCard}>
              <Text style={styles.workoutType}>{workout.workout_type}</Text>
              <Text style={styles.exerciseName}>{current.display_name}</Text>

              {/* Quantidade */}
              <View style={styles.quantityBox}>
                {current.type === 'reps' ? (
                  <>
                    <Text style={styles.quantityNumber}>{current.quantity}</Text>
                    <Text style={styles.quantityLabel}>repetições</Text>
                  </>
                ) : (
                  <>
                    <Text style={styles.quantityNumber}>
                      {isRunning ? timeLeft : current.quantity}
                    </Text>
                    <Text style={styles.quantityLabel}>segundos</Text>
                  </>
                )}
              </View>

              {/* Timer bar para exercícios de tempo */}
              {isTimeBased && isRunning && (
                <View style={styles.timerBarContainer}>
                  <Animated.View style={[styles.timerBarFill, { width: progressWidth }]} />
                </View>
              )}
            </View>

            {/* Lista restante */}
            <Text style={styles.upNextLabel}>A seguir</Text>
            {exercises.slice(currentIndex + 1, currentIndex + 4).map((ex, i) => (
              <View key={i} style={styles.upNextItem}>
                <Text style={styles.upNextDot}>·</Text>
                <Text style={styles.upNextName}>{ex.display_name}</Text>
                <Text style={styles.upNextQty}>
                  {ex.quantity} {ex.type === 'reps' ? 'reps' : 'seg'}
                </Text>
              </View>
            ))}

            <TouchableOpacity style={styles.doneBtn} onPress={handleExerciseDone}>
              <Text style={styles.doneBtnText}>
                {current.type === 'reps'
                  ? isLast ? '🏁 Terminar Treino' : '✓ Feito'
                  : isRunning ? '⏭ Saltar' : '▶ Iniciar'}
              </Text>
            </TouchableOpacity>
          </>
        ) : (
          /* Ecrã de descanso */
          <View style={styles.restContainer}>
            <Text style={styles.restTitle}>Descansa</Text>
            <Text style={styles.restTimer}>{timeLeft}s</Text>
            <View style={styles.timerBarContainer}>
              <Animated.View style={[styles.timerBarFill, { width: progressWidth }]} />
            </View>
            <Text style={styles.nextUpLabel}>Próximo:</Text>
            <Text style={styles.nextExercise}>
              {isLast ? '🏁 Fim do Treino' : exercises[currentIndex + 1]?.display_name}
            </Text>
            <TouchableOpacity style={styles.skipBtn} onPress={skipRest}>
              <Text style={styles.skipBtnText}>Saltar Descanso →</Text>
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
  workoutType: { color: '#f97316', fontSize: 12, fontWeight: 'bold', marginBottom: 8 },
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