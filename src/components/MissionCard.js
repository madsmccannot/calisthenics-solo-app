import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, radius } from '../theme';
import { useI18n } from '../i18n/I18nContext';
import {
  getDailyMissions,
  toggleMission,
  claimMissions,
} from '../services/progressStore';
import { missionRewards } from '../config/missions';

// Daily missions card on the Dashboard. Manual missions (water/sleep/...) are
// tappable; the workout mission auto-completes when the day's workout is done.
export default function MissionCard({ onClaimed }) {
  const { t } = useI18n();
  const [missions, setMissions] = useState(null);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    setMissions(await getDailyMissions());
  };

  const handleToggle = async (item) => {
    if (item.auto || missions?.claimed) return;
    setMissions(await toggleMission(item.id));
  };

  const handleClaim = async () => {
    const result = await claimMissions();
    setMissions(await getDailyMissions());
    if (result) onClaimed?.(result);
  };

  if (!missions) return null;

  const allDone = missions.items.every((i) => i.done);
  const rewards = missionRewards(missions);

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('missions.daily')}</Text>
        <Text style={styles.reward}>
          +{rewards.xp} XP · +{rewards.coins} 🪙
        </Text>
      </View>

      {missions.items.map((item) => (
        <TouchableOpacity
          key={item.id}
          style={styles.row}
          activeOpacity={item.auto ? 1 : 0.6}
          onPress={() => handleToggle(item)}
        >
          <View style={[styles.check, item.done && styles.checkDone]}>
            {item.done && <Text style={styles.checkMark}>✓</Text>}
          </View>
          <Text style={styles.emoji}>{item.emoji}</Text>
          <Text style={[styles.label, item.done && styles.labelDone]}>
            {t('missions.' + item.id)}
          </Text>
          {item.auto && !item.done && <Text style={styles.autoTag}>{t('missions.autoTag')}</Text>}
        </TouchableOpacity>
      ))}

      {missions.claimed ? (
        <View style={styles.claimedBanner}>
          <Text style={styles.claimedText}>{t('missions.received')}</Text>
        </View>
      ) : (
        <TouchableOpacity
          style={[styles.claimBtn, !allDone && styles.claimBtnDisabled]}
          onPress={handleClaim}
          disabled={!allDone}
        >
          <Text style={[styles.claimText, !allDone && styles.claimTextDisabled]}>
            {allDone ? t('missions.claim', { xp: rewards.xp }) : t('missions.todo')}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  title: { color: colors.text, fontSize: 16, fontWeight: 'bold' },
  reward: { color: colors.gold, fontSize: 13, fontWeight: 'bold' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardInner,
  },
  check: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  checkDone: { backgroundColor: colors.primary, borderColor: colors.primary },
  checkMark: { color: colors.onPrimary, fontSize: 13, fontWeight: 'bold' },
  emoji: { fontSize: 16, marginRight: 8 },
  label: { color: colors.text, fontSize: 14, flex: 1 },
  labelDone: { color: colors.textFaint, textDecorationLine: 'line-through' },
  autoTag: {
    color: colors.textFaint,
    fontSize: 10,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  claimBtn: {
    marginTop: 14,
    backgroundColor: colors.primary,
    padding: 14,
    borderRadius: radius.lg,
    alignItems: 'center',
  },
  claimBtnDisabled: { backgroundColor: colors.cardInner },
  claimText: { color: colors.onPrimary, fontSize: 15, fontWeight: 'bold' },
  claimTextDisabled: { color: colors.textFaint },
  claimedBanner: {
    marginTop: 14,
    padding: 12,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.primary,
    alignItems: 'center',
  },
  claimedText: { color: colors.primary, fontSize: 14, fontWeight: 'bold' },
});
