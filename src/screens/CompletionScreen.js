import React, { useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Animated, ScrollView
} from 'react-native';
import { colors, radius } from '../theme';

export default function CompletionScreen({ workout, streak, xpResult, onBack }) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const bounceAnim = useRef(new Animated.Value(0)).current;
  const levelUpAnim = useRef(new Animated.Value(0)).current;
  const barAnim = useRef(new Animated.Value(0)).current;

  const leveledUp = xpResult?.leveledUp;
  const total = xpResult?.total ?? 0;
  const breakdown = xpResult?.breakdown ?? [];
  const levelInfo = xpResult?.levelInfo;
  const progress = Math.max(0, Math.min(1, levelInfo?.progress ?? 0));

  useEffect(() => {
    Animated.sequence([
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.spring(bounceAnim, { toValue: 1, friction: 3, tension: 40, useNativeDriver: true }),
    ]).start();

    Animated.timing(barAnim, {
      toValue: progress, duration: 900, delay: 500, useNativeDriver: false,
    }).start();

    if (leveledUp) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(levelUpAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
          Animated.timing(levelUpAnim, { toValue: 0.4, duration: 700, useNativeDriver: true }),
        ])
      ).start();
    }
  }, []);

  const barWidth = barAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
          <Animated.Text style={[styles.trophy, { transform: [{ scale: bounceAnim }] }]}>
            🏆
          </Animated.Text>

          <Text style={styles.title}>Treino Concluído!</Text>
          <Text style={styles.subtitle}>Dia {workout.day_number} completo</Text>

          {/* Total de XP ganho */}
          <View style={styles.xpTotalBox}>
            <Text style={styles.xpTotalLabel}>XP ganho</Text>
            <Text style={styles.xpTotalValue}>+{total}</Text>
          </View>

          {/* Level up */}
          {leveledUp && levelInfo && (
            <Animated.View style={[styles.levelUpBox, { opacity: levelUpAnim }]}>
              <Text style={styles.levelUpText}>⭐ LEVEL UP</Text>
              <Text style={styles.levelUpSub}>
                {xpResult.fromLevel} → {xpResult.toLevel} · {xpResult.title}
              </Text>
            </Animated.View>
          )}

          {/* Barra de progresso do nível atual */}
          {levelInfo && (
            <View style={styles.levelBarWrap}>
              <View style={styles.levelBarHeader}>
                <Text style={styles.levelBarLevel}>Nível {levelInfo.level}</Text>
                <Text style={styles.levelBarXp}>
                  {levelInfo.xpIntoLevel} / {levelInfo.xpForNext}
                </Text>
              </View>
              <View style={styles.levelBarTrack}>
                <Animated.View style={[styles.levelBarFill, { width: barWidth }]} />
              </View>
            </View>
          )}

          {/* Repartição por exercício */}
          {breakdown.length > 0 && (
            <View style={styles.breakdownBox}>
              {breakdown.map((b, i) => (
                <View key={i} style={styles.breakdownRow}>
                  <Text style={styles.breakdownName} numberOfLines={1}>{b.name}</Text>
                  <Text style={styles.breakdownXp}>+{b.xp}</Text>
                </View>
              ))}
              {xpResult?.bonus > 0 && (
                <View style={styles.breakdownRow}>
                  <Text style={styles.breakdownBonus}>Bónus de conclusão</Text>
                  <Text style={styles.breakdownXp}>+{xpResult.bonus}</Text>
                </View>
              )}
              {xpResult?.streakBonus > 0 && (
                <View style={styles.breakdownRow}>
                  <Text style={styles.breakdownBonus}>🔥 Bónus de streak</Text>
                  <Text style={styles.breakdownXp}>+{xpResult.streakBonus}</Text>
                </View>
              )}
            </View>
          )}

          {/* Stats rápidas */}
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
        </ScrollView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { flex: 1 },
  scroll: { alignItems: 'center', padding: 24, paddingTop: 60, paddingBottom: 40 },
  trophy: { fontSize: 72, marginBottom: 12 },
  title: { fontSize: 30, fontWeight: 'bold', color: colors.text, marginBottom: 6 },
  subtitle: { fontSize: 16, color: colors.primary, marginBottom: 24 },
  xpTotalBox: {
    alignItems: 'center', backgroundColor: colors.card, borderRadius: radius.xxl,
    paddingVertical: 20, paddingHorizontal: 40, borderWidth: 1, borderColor: colors.gold,
    marginBottom: 16,
  },
  xpTotalLabel: { color: colors.textMuted, fontSize: 13, marginBottom: 4 },
  xpTotalValue: { color: colors.gold, fontSize: 48, fontWeight: 'bold' },
  levelUpBox: {
    alignItems: 'center', backgroundColor: colors.card, borderRadius: radius.xl,
    paddingVertical: 14, paddingHorizontal: 28, borderWidth: 1, borderColor: colors.purple,
    marginBottom: 16,
  },
  levelUpText: { color: colors.purple, fontSize: 22, fontWeight: 'bold', letterSpacing: 2 },
  levelUpSub: { color: colors.textMuted, fontSize: 13, marginTop: 4 },
  levelBarWrap: { width: '100%', marginBottom: 20 },
  levelBarHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  levelBarLevel: { color: colors.text, fontSize: 13, fontWeight: 'bold' },
  levelBarXp: { color: colors.textMuted, fontSize: 13 },
  levelBarTrack: {
    height: 10, backgroundColor: colors.card, borderRadius: 5, overflow: 'hidden',
    borderWidth: 1, borderColor: colors.border,
  },
  levelBarFill: { height: '100%', backgroundColor: colors.gold, borderRadius: 5 },
  breakdownBox: {
    width: '100%', backgroundColor: colors.card, borderRadius: radius.xl,
    padding: 16, borderWidth: 1, borderColor: colors.border, marginBottom: 20,
  },
  breakdownRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: colors.cardInner,
  },
  breakdownName: { color: colors.text, fontSize: 14, flex: 1, marginRight: 12 },
  breakdownBonus: { color: colors.gold, fontSize: 14, flex: 1, marginRight: 12 },
  breakdownXp: { color: colors.gold, fontSize: 14, fontWeight: 'bold' },
  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 20, width: '100%' },
  statBox: {
    flex: 1, backgroundColor: colors.card, borderRadius: radius.lg,
    padding: 14, alignItems: 'center', borderWidth: 1, borderColor: colors.border,
  },
  statNumber: { fontSize: 16, fontWeight: 'bold', color: colors.text, marginBottom: 4 },
  statLabel: { fontSize: 11, color: colors.textMuted, textAlign: 'center' },
  messageBox: {
    backgroundColor: colors.card, borderRadius: radius.lg, padding: 18,
    marginBottom: 24, borderWidth: 1, borderColor: colors.primary, width: '100%',
  },
  message: { color: colors.text, fontSize: 15, textAlign: 'center', lineHeight: 22 },
  backBtn: {
    backgroundColor: colors.primary, padding: 18, borderRadius: radius.xl,
    alignItems: 'center', width: '100%',
  },
  backBtnText: { fontSize: 18, fontWeight: 'bold', color: colors.onPrimary },
});
