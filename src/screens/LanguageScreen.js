import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { colors, radius } from '../theme';
import { useI18n } from '../i18n/I18nContext';
import LanguagePicker from '../components/LanguagePicker';

// First-run language screen. Pre-selects the device language; confirming marks
// the choice as made (so it won't show again).
export default function LanguageScreen() {
  const { lang, setLang, t } = useI18n();
  const [selected, setSelected] = useState(lang);

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.logo}>🌍</Text>
        <Text style={styles.title}>{t('lang.title')}</Text>
        <Text style={styles.subtitle}>{t('lang.subtitle')}</Text>

        <LanguagePicker value={selected} onSelect={setSelected} />

        <TouchableOpacity style={styles.btn} onPress={() => setLang(selected)}>
          <Text style={styles.btnText}>{t('common.continue')}</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 28 },
  logo: { fontSize: 52, textAlign: 'center', marginBottom: 8 },
  title: { fontSize: 24, fontWeight: 'bold', color: colors.text, textAlign: 'center' },
  subtitle: { fontSize: 14, color: colors.textMuted, textAlign: 'center', marginTop: 8, marginBottom: 28 },
  btn: { backgroundColor: colors.primary, borderRadius: radius.lg, padding: 16, alignItems: 'center', marginTop: 24 },
  btnText: { color: colors.onPrimary, fontSize: 16, fontWeight: 'bold' },
});
