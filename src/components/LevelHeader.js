import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { colors, radius } from '../theme';

// Cabeçalho de progressão no topo do Dashboard: nível, título, barra de XP,
// streak e moedas. `summary` vem de progressStore.getProgressSummary().
export default function LevelHeader({ summary, streak = 0 }) {
  const fillAnim = useRef(new Animated.Value(0)).current;

  const level = summary?.level ?? 1;
  const title = summary?.title ?? 'Novato';
  const xpInto = summary?.xpIntoLevel ?? 0;
  const xpNext = summary?.xpForNext ?? 125;
  const coins = summary?.coins ?? 0;
  const progress = Math.max(0, Math.min(1, summary?.progress ?? 0));

  useEffect(() => {
    Animated.timing(fillAnim, {
      toValue: progress,
      duration: 600,
      useNativeDriver: false,
    }).start();
  }, [progress]);

  const width = fillAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        <View style={styles.levelBadge}>
          <Text style={styles.levelNum}>{level}</Text>
        </View>
        <View style={styles.identity}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>Nível {level}</Text>
        </View>
        <View style={styles.pills}>
          <View style={styles.pill}>
            <Text style={styles.pillIcon}>🔥</Text>
            <Text style={styles.pillText}>{streak}</Text>
          </View>
          <View style={styles.pill}>
            <Text style={styles.pillIcon}>🪙</Text>
            <Text style={[styles.pillText, { color: colors.gold }]}>{coins}</Text>
          </View>
        </View>
      </View>

      <View style={styles.barTrack}>
        <Animated.View style={[styles.barFill, { width }]} />
      </View>
      <Text style={styles.xpText}>
        XP {xpInto} / {xpNext}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.card,
    borderRadius: radius.xxl,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 16,
  },
  topRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  levelBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.bg,
    borderWidth: 2,
    borderColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  levelNum: { color: colors.gold, fontSize: 22, fontWeight: 'bold' },
  identity: { flex: 1, marginLeft: 12 },
  title: { color: colors.text, fontSize: 18, fontWeight: 'bold' },
  subtitle: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  pills: { flexDirection: 'row', gap: 8 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pillIcon: { fontSize: 13 },
  pillText: { color: colors.text, fontSize: 13, fontWeight: 'bold' },
  barTrack: {
    height: 12,
    backgroundColor: colors.bg,
    borderRadius: 6,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  barFill: {
    height: '100%',
    backgroundColor: colors.gold,
    borderRadius: 6,
  },
  xpText: { color: colors.textMuted, fontSize: 12, marginTop: 6, textAlign: 'right' },
});
