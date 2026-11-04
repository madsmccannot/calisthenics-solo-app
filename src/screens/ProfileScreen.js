import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, Modal, ActivityIndicator
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ConfirmModal from '../components/ConfirmModal';
import InfoModal from '../components/InfoModal';
import Avatar from '../components/Avatar';
import LockerModal from '../components/LockerModal';
import LanguagePicker from '../components/LanguagePicker';
import { colors, radius } from '../theme';
import { useI18n } from '../i18n/I18nContext';
import { getRegenerableCount, regenerateFuturePlan, getPlanClass, getPlanPrefs } from '../services/planService';
import { PROFILE_OPTIONS } from '../domain/planGenerator';
import { EXERCISES, exerciseName } from '../domain/exercises';
import { getProgressSummary, getAvatar } from '../services/progressStore';
import { getStreakData } from '../services/localStore';
import { scheduleSync, getDisplayName } from '../services/cloudSync';

const LEVELS = ['Iniciante', 'Intermédio', 'Avançado'];

function bmiInfo(weight, height) {
  const w = parseFloat(weight);
  const h = parseFloat(height) / 100;
  if (!w || !h) return null;
  const bmi = w / (h * h);
  let color = colors.primary;
  if (bmi < 18.5) color = colors.blue;
  else if (bmi >= 25 && bmi < 30) color = colors.orange;
  else if (bmi >= 30) color = colors.red;
  return { value: bmi.toFixed(1), color };
}

function formatTime(totalSeconds = 0) {
  const m = Math.round(totalSeconds / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

export default function ProfileScreen({ profile, onProfileUpdate, onReset, onPlanChanged, activeTab, onSignOut, email }) {
  const { t, lang, setLang } = useI18n();
  const [weight, setWeight] = useState(profile?.weight || '');
  const [height, setHeight] = useState(profile?.height || '');
  const [level, setLevel] = useState(profile?.level || 'Iniciante');
  const [daysPerWeek, setDaysPerWeek] = useState(profile?.daysPerWeek || 6);
  const [sessionMinutes, setSessionMinutes] = useState(profile?.sessionMinutes ?? null);
  const [exclude, setExclude] = useState(Array.isArray(profile?.exclude) ? profile.exclude : []);
  const [saved, setSaved] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showRegenConfirm, setShowRegenConfirm] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [planClass, setPlanClass] = useState(null);
  const [planPrefs, setPlanPrefs] = useState(null);
  const [regenCount, setRegenCount] = useState(0);
  const [info, setInfo] = useState(null);

  const [avatar, setAvatar] = useState(null);
  const [summary, setSummary] = useState(null);
  const [streak, setStreak] = useState({ current: 0, best: 0 });
  const [showLocker, setShowLocker] = useState(false);
  const [displayName, setDisplayName] = useState(null);

  useEffect(() => {
    if (activeTab === undefined || activeTab === 'profile') loadAll();
  }, [activeTab]);

  const loadAll = async () => {
    setPlanClass(await getPlanClass());
    setPlanPrefs(await getPlanPrefs());
    setRegenCount(await getRegenerableCount());
    setAvatar(await getAvatar());
    setSummary(await getProgressSummary());
    setStreak(await getStreakData());
    setDisplayName(await getDisplayName());
  };

  const sameSet = (a = [], b = []) => a.length === b.length && [...a].sort().join('|') === [...b].sort().join('|');
  // Compare against what the PLAN was generated with (planPrefs/planClass), not
  // the saved profile — otherwise Save would clear the prompt before the plan is
  // actually regenerated.
  const settingsDiffer =
    (sessionMinutes ?? null) !== (planPrefs?.sessionMinutes ?? null) ||
    !sameSet(exclude, Array.isArray(planPrefs?.exclude) ? planPrefs.exclude : []);
  // Session length and exclusions take effect by regenerating future days;
  // daysPerWeek only reshapes the schedule at the next season, so it does not
  // drive this prompt.
  const needsRegen = regenCount > 0 && (level !== planClass || settingsDiffer);
  const bmi = bmiInfo(profile?.weight, profile?.height);
  const stats = summary?.stats || {};

  const buildProfile = () => ({ ...(profile || {}), weight, height, level, daysPerWeek, sessionMinutes, exclude });

  const toggleExclude = (id) =>
    setExclude((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const handleSave = async () => {
    if (!weight || !height) {
      setInfo({ emoji: '⚠️', title: t('profile.missingTitle'), message: t('profile.missingMsg') });
      return;
    }
    const updated = buildProfile();
    await AsyncStorage.setItem('userProfile', JSON.stringify(updated));
    onProfileUpdate(updated);
    scheduleSync();
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleRegenConfirm = async () => {
    setShowRegenConfirm(false);
    setRegenerating(true);
    const updated = buildProfile();
    await AsyncStorage.setItem('userProfile', JSON.stringify(updated));
    onProfileUpdate(updated);
    const { changed } = await regenerateFuturePlan(updated, lang);
    setPlanClass(level);
    setPlanPrefs(await getPlanPrefs());
    setRegenCount(await getRegenerableCount());
    setRegenerating(false);
    onPlanChanged?.();
    if (changed > 0) {
      setInfo({ emoji: '✅', title: t('profile.updatedTitle'), message: t('profile.updatedMsg', { n: changed, level: t('level.' + level) }) });
    } else {
      setInfo({ emoji: '📡', title: t('profile.nothingTitle'), message: t('profile.nothingMsg') });
    }
  };

  const evoStats = [
    { emoji: '⭐', value: summary?.level ?? 1, label: t('profile.statLevel') },
    { emoji: '⚖️', value: profile?.weight ? `${profile.weight}kg` : '—', label: t('profile.statWeight') },
    { emoji: '📊', value: bmi ? bmi.value : '—', label: t('profile.statBmi'), color: bmi?.color },
    { emoji: '📅', value: stats.totalWorkouts ?? 0, label: t('profile.statWorkouts') },
    { emoji: '🔥', value: streak.current ?? 0, label: t('profile.statStreak') },
    { emoji: '💪', value: stats.totalExercises ?? 0, label: t('profile.statExercises') },
    { emoji: '⏱️', value: formatTime(stats.totalSeconds), label: t('profile.statTime') },
    { emoji: '🪙', value: summary?.coins ?? 0, label: t('profile.statCoins'), color: colors.gold },
  ];

  return (
    <>
      <ScrollView style={styles.container}>
        <Text style={styles.title}>{t('profile.title')}</Text>

        {/* Identity / Avatar */}
        <View style={styles.identityCard}>
          <Avatar avatar={avatar} size={110} />
          <View style={styles.identityInfo}>
            <Text style={styles.identityTitle} numberOfLines={1}>
              {displayName || t(summary?.title || 'title.novice')}
            </Text>
            <Text style={styles.identitySub}>
              {t('profile.statLevel')} {summary?.level ?? 1} · {t(summary?.title || 'title.novice')}
            </Text>
            {email ? (
              <Text style={styles.identityEmail} numberOfLines={1}>{email}</Text>
            ) : null}
            <View style={styles.coinPill}>
              <Text style={styles.coinText}>🪙 {summary?.coins ?? 0}</Text>
            </View>
          </View>
        </View>

        <TouchableOpacity style={styles.lockerBtn} onPress={() => setShowLocker(true)}>
          <Text style={styles.lockerBtnText}>{t('profile.customize')}</Text>
        </TouchableOpacity>

        {/* Physical evolution */}
        <Text style={styles.sectionTitle}>{t('profile.evolution')}</Text>
        <View style={styles.evoGrid}>
          {evoStats.map((s) => (
            <View key={s.label} style={styles.evoBox}>
              <Text style={styles.evoEmoji}>{s.emoji}</Text>
              <Text style={[styles.evoValue, s.color && { color: s.color }]}>{s.value}</Text>
              <Text style={styles.evoLabel}>{s.label}</Text>
            </View>
          ))}
        </View>

        {/* Profile details */}
        <Text style={styles.sectionTitle}>{t('profile.data')}</Text>
        <View style={styles.card}>
          <Text style={styles.label}>{t('profile.weight')}</Text>
          <TextInput
            style={styles.input}
            keyboardType="numeric"
            value={weight}
            onChangeText={setWeight}
            placeholder="ex: 78"
            placeholderTextColor="#555"
          />

          <Text style={styles.label}>{t('profile.height')}</Text>
          <TextInput
            style={styles.input}
            keyboardType="numeric"
            value={height}
            onChangeText={setHeight}
            placeholder="ex: 175"
            placeholderTextColor="#555"
          />

          <Text style={styles.label}>{t('profile.level')}</Text>
          <View style={styles.levelContainer}>
            {LEVELS.map((l) => (
              <TouchableOpacity
                key={l}
                style={[styles.levelBtn, level === l && styles.levelBtnActive]}
                onPress={() => setLevel(l)}
              >
                <Text style={[styles.levelText, level === l && styles.levelTextActive]}>
                  {t('level.' + l)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>{t('setup.days')}</Text>
          <View style={styles.levelContainer}>
            {PROFILE_OPTIONS.daysPerWeek.map((d) => (
              <TouchableOpacity
                key={d}
                style={[styles.levelBtn, daysPerWeek === d && styles.levelBtnActive]}
                onPress={() => setDaysPerWeek(d)}
              >
                <Text style={[styles.levelText, daysPerWeek === d && styles.levelTextActive]}>{d}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>{t('setup.duration')}</Text>
          <View style={styles.levelContainer}>
            {PROFILE_OPTIONS.sessionMinutes.map((m) => (
              <TouchableOpacity
                key={String(m)}
                style={[styles.levelBtn, sessionMinutes === m && styles.levelBtnActive]}
                onPress={() => setSessionMinutes(m)}
              >
                <Text style={[styles.levelText, sessionMinutes === m && styles.levelTextActive]}>
                  {m == null ? t('setup.auto') : `${m}m`}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>{t('profile.exclusions')}</Text>
          <View style={styles.chipRow}>
            {EXERCISES.map((e) => {
              const on = exclude.includes(e.id);
              return (
                <TouchableOpacity
                  key={e.id}
                  style={[styles.chip, on && styles.chipActive]}
                  onPress={() => toggleExclude(e.id)}
                >
                  <Text style={[styles.chipText, on && styles.chipTextActive]}>
                    {on ? '✕ ' : ''}{exerciseName(e.id, lang)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
            <Text style={styles.saveBtnText}>{saved ? t('profile.saved') : t('profile.save')}</Text>
          </TouchableOpacity>

          {needsRegen && (
            <TouchableOpacity style={styles.applyLoadBtn} onPress={() => setShowRegenConfirm(true)}>
              <Text style={styles.applyLoadText}>
                {level !== planClass
                  ? t('profile.applyLoad', { level: t('level.' + level), n: regenCount })
                  : t('profile.applyChanges', { n: regenCount })}
              </Text>
              {level !== planClass && (
                <Text style={styles.applyLoadSub}>
                  {planClass ? t('profile.applyLoadSub', { level: t('level.' + planClass) }) : t('profile.applyLoadSubOld')}
                </Text>
              )}
            </TouchableOpacity>
          )}
        </View>

        {/* Language */}
        <Text style={styles.sectionTitle}>{t('lang.settingLabel')}</Text>
        <View style={styles.langCard}>
          <LanguagePicker value={lang} onSelect={setLang} />
        </View>

        {onSignOut && (
          <TouchableOpacity style={styles.signOutBtn} onPress={onSignOut}>
            <Text style={styles.signOutText}>{t('profile.signOut')}</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.resetBtn} onPress={() => setShowConfirm(true)}>
          <Text style={styles.resetBtnText}>{t('profile.resetAll')}</Text>
        </TouchableOpacity>
      </ScrollView>

      <LockerModal
        visible={showLocker}
        onClose={() => setShowLocker(false)}
        onChanged={loadAll}
      />

      <ConfirmModal
        visible={showConfirm}
        emoji="⚠️"
        title={t('profile.resetTitle')}
        message={t('profile.resetMsg')}
        confirmText={t('profile.resetConfirm')}
        cancelText={t('profile.cancel')}
        confirmColor="#ef4444"
        onConfirm={() => { setShowConfirm(false); onReset(); }}
        onDismiss={() => setShowConfirm(false)}
      />

      <ConfirmModal
        visible={showRegenConfirm}
        emoji="⚡"
        title={t('profile.classChangedTitle')}
        message={t('profile.classChangedMsg', { n: regenCount })}
        confirmText={t('profile.regenerate')}
        cancelText={t('profile.keep')}
        confirmColor="#4ade80"
        onConfirm={handleRegenConfirm}
        onDismiss={() => setShowRegenConfirm(false)}
      />

      <Modal transparent visible={regenerating} animationType="fade">
        <View style={styles.regenOverlay}>
          <View style={styles.regenBox}>
            <ActivityIndicator size="large" color="#4ade80" />
            <Text style={styles.regenTitle}>{t('profile.regenerating')}</Text>
            <Text style={styles.regenSub}>{t('profile.regeneratingSub')}</Text>
          </View>
        </View>
      </Modal>

      <InfoModal
        visible={!!info}
        emoji={info?.emoji}
        title={info?.title}
        message={info?.message}
        onDismiss={() => setInfo(null)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: 16 },
  title: { fontSize: 22, fontWeight: 'bold', color: colors.text, marginBottom: 20, marginTop: 40 },
  sectionTitle: { fontSize: 15, fontWeight: 'bold', color: colors.textMuted, marginBottom: 10, marginTop: 4 },

  identityCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card,
    borderRadius: radius.xl, padding: 16, borderWidth: 1, borderColor: colors.border, marginBottom: 12,
  },
  identityInfo: { flex: 1, marginLeft: 18 },
  identityTitle: { color: colors.text, fontSize: 22, fontWeight: 'bold' },
  identitySub: { color: colors.textMuted, fontSize: 14, marginTop: 2 },
  identityEmail: { color: colors.textFaint, fontSize: 12, marginTop: 4 },
  coinPill: {
    alignSelf: 'flex-start', marginTop: 12, backgroundColor: colors.bg,
    borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 6,
    borderWidth: 1, borderColor: colors.gold,
  },
  coinText: { color: colors.gold, fontWeight: 'bold', fontSize: 14 },

  lockerBtn: {
    backgroundColor: colors.card, borderRadius: radius.lg, padding: 14,
    alignItems: 'center', borderWidth: 1, borderColor: colors.purple, marginBottom: 20,
  },
  lockerBtnText: { color: colors.purple, fontSize: 15, fontWeight: 'bold' },
  langCard: { marginBottom: 16 },

  evoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  evoBox: {
    width: '47%', backgroundColor: colors.card, borderRadius: radius.lg,
    padding: 16, alignItems: 'center', borderWidth: 1, borderColor: colors.border,
  },
  evoEmoji: { fontSize: 22, marginBottom: 6 },
  evoValue: { color: colors.text, fontSize: 22, fontWeight: 'bold' },
  evoLabel: { color: colors.textMuted, fontSize: 12, marginTop: 2 },

  card: {
    backgroundColor: colors.card, borderRadius: radius.xl,
    padding: 20, borderWidth: 1, borderColor: colors.border, marginBottom: 16,
  },
  label: { fontSize: 14, color: colors.textMuted, marginBottom: 8, marginTop: 16 },
  input: {
    backgroundColor: colors.cardInner, color: colors.text, borderRadius: 10,
    padding: 14, fontSize: 16, borderWidth: 1, borderColor: colors.borderLight,
  },
  levelContainer: { flexDirection: 'row', gap: 10, marginTop: 8 },
  levelBtn: {
    flex: 1, paddingVertical: 12, paddingHorizontal: 4, borderRadius: 10, minHeight: 48,
    backgroundColor: colors.cardInner, borderWidth: 1, borderColor: colors.borderLight,
    alignItems: 'center', justifyContent: 'center',
  },
  levelBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  levelText: { color: colors.textMuted, fontWeight: '600', fontSize: 13, textAlign: 'center' },
  levelTextActive: { color: colors.onPrimary },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  chip: {
    paddingVertical: 8, paddingHorizontal: 12, borderRadius: radius.md,
    backgroundColor: colors.cardInner, borderWidth: 1, borderColor: colors.borderLight,
  },
  chipActive: { backgroundColor: colors.red, borderColor: colors.red },
  chipText: { color: colors.textMuted, fontSize: 13 },
  chipTextActive: { color: colors.text, fontWeight: '600' },
  saveBtn: { marginTop: 24, backgroundColor: colors.primary, padding: 16, borderRadius: radius.lg, alignItems: 'center' },
  saveBtnText: { fontSize: 16, fontWeight: 'bold', color: colors.onPrimary },
  applyLoadBtn: {
    marginTop: 12, backgroundColor: colors.cardInner, padding: 14,
    borderRadius: radius.md, alignItems: 'center', borderWidth: 1, borderColor: colors.gold,
  },
  applyLoadText: { color: colors.gold, fontSize: 14, fontWeight: 'bold', textAlign: 'center' },
  applyLoadSub: { color: colors.textMuted, fontSize: 11, marginTop: 4, textAlign: 'center' },
  signOutBtn: {
    marginTop: 8, padding: 14, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border, alignItems: 'center',
  },
  signOutText: { color: colors.textMuted, fontSize: 15 },
  resetBtn: {
    marginTop: 8, marginBottom: 80, padding: 14,
    borderRadius: radius.md, borderWidth: 1, borderColor: colors.red, alignItems: 'center',
  },
  resetBtnText: { color: colors.red, fontSize: 15 },
  regenOverlay: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'center', alignItems: 'center', padding: 32 },
  regenBox: {
    backgroundColor: colors.card, borderRadius: radius.round, padding: 32,
    alignItems: 'center', borderWidth: 1, borderColor: colors.border, width: '100%',
  },
  regenTitle: { color: colors.text, fontSize: 18, fontWeight: 'bold', marginTop: 20, textAlign: 'center' },
  regenSub: { color: colors.textMuted, fontSize: 13, marginTop: 8, textAlign: 'center' },
});
