import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, radius } from '../theme';
import { useI18n } from '../i18n/I18nContext';

const TIER_COLOR = {
  bronze: colors.bronze,
  silver: colors.silver,
  gold: colors.gold,
};

// Grelha de medalhas. As desbloqueadas aparecem a cor do tier; as bloqueadas
// ficam esbatidas com cadeado. `medals` vem de progressStore.getMedalsStatus().
export default function MedalsWall({ medals = [] }) {
  const { t } = useI18n();
  const unlockedCount = medals.filter((m) => m.unlocked).length;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.cardLabel}>{t('medals.title')}</Text>
        <Text style={styles.count}>
          {unlockedCount} / {medals.length}
        </Text>
      </View>

      <View style={styles.grid}>
        {medals.map((m) => {
          const tint = TIER_COLOR[m.tier] || colors.gold;
          return (
            <View
              key={m.id}
              style={[
                styles.medal,
                m.unlocked
                  ? { borderColor: tint }
                  : { borderColor: colors.border, opacity: 0.45 },
              ]}
            >
              <Text style={styles.emoji}>{m.unlocked ? m.emoji : '🔒'}</Text>
              <Text
                style={[styles.title, m.unlocked && { color: tint }]}
                numberOfLines={2}
              >
                {m.title}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  cardLabel: { color: colors.textMuted, fontSize: 13 },
  count: { color: colors.gold, fontSize: 13, fontWeight: 'bold' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  medal: {
    width: '30.5%',
    aspectRatio: 0.85,
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    borderWidth: 1.5,
    padding: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: { fontSize: 30, marginBottom: 6 },
  title: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
  },
});
