import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { colors, radius } from '../theme';
import { useI18n } from '../i18n/I18nContext';
import Avatar from '../components/Avatar';
import { getFeed } from '../services/feed';
import { getAvatar } from '../services/progressStore';

// Cores estáveis para os avatares dos "outros" (a partir do nome).
const OTHER_COLORS = ['#3b82f6', '#f97316', '#a78bfa', '#22c55e', '#ef4444', '#fbbf24'];
function colorFor(name) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return OTHER_COLORS[h % OTHER_COLORS.length];
}

export default function FeedScreen({ activeTab }) {
  const { t } = useI18n();
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState('all');
  const [avatar, setAvatar] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const relTime = (ts) => {
    const m = Math.floor((Date.now() - ts) / 60000);
    if (m < 1) return t('feed.now');
    if (m < 60) return t('feed.min', { m });
    const h = Math.floor(m / 60);
    if (h < 24) return t('feed.hour', { h });
    const d = Math.floor(h / 24);
    return d === 1 ? t('feed.yesterday') : t('feed.day', { d });
  };

  useEffect(() => {
    if (activeTab === undefined || activeTab === 'feed') load();
  }, [activeTab, filter]);

  const load = async () => {
    setAvatar(await getAvatar());
    setItems(await getFeed(filter));
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const ownCount = items.filter((i) => i.who === 'you').length;

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
      }
    >
      <Text style={styles.title}>{t('feed.title')}</Text>

      <View style={styles.tabs}>
        {[{ k: 'all', l: t('feed.all') }, { k: 'me', l: t('feed.me') }].map((tab) => (
          <TouchableOpacity
            key={tab.k}
            style={[styles.tab, filter === tab.k && styles.tabActive]}
            onPress={() => setFilter(tab.k)}
          >
            <Text style={[styles.tabText, filter === tab.k && styles.tabTextActive]}>{tab.l}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {filter === 'me' && ownCount === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyEmoji}>📣</Text>
          <Text style={styles.emptyText}>{t('feed.emptyMsg')}</Text>
        </View>
      ) : (
        items.map((item) => (
          <View key={item.id} style={styles.card}>
            {item.who === 'you' ? (
              <View style={styles.youAvatar}>
                <Avatar avatar={avatar} size={40} />
              </View>
            ) : (
              <View style={[styles.otherAvatar, { backgroundColor: colorFor(item.name) }]}>
                <Text style={styles.otherInitial}>{item.name[0]}</Text>
              </View>
            )}

            <View style={styles.body}>
              <Text style={styles.name}>
                {item.who === 'you' ? t('feed.you') : item.name}
              </Text>
              <Text style={styles.text}>
                {item.emoji} {item.title}
              </Text>
              {item.subtitle ? <Text style={styles.subtitle}>{item.subtitle}</Text> : null}
            </View>

            <Text style={styles.time}>{relTime(item.ts)}</Text>
          </View>
        ))
      )}

      <View style={{ height: 90 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: 16 },
  title: { fontSize: 22, fontWeight: 'bold', color: colors.text, marginBottom: 16, marginTop: 40 },
  tabs: {
    flexDirection: 'row', backgroundColor: colors.card, borderRadius: radius.md,
    padding: 4, marginBottom: 16, borderWidth: 1, borderColor: colors.border,
  },
  tab: { flex: 1, paddingVertical: 8, borderRadius: radius.sm, alignItems: 'center' },
  tabActive: { backgroundColor: colors.primary },
  tabText: { color: colors.textMuted, fontWeight: '600', fontSize: 14 },
  tabTextActive: { color: colors.onPrimary },
  card: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card,
    borderRadius: radius.lg, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: colors.border,
  },
  youAvatar: {
    width: 44, height: 44, borderRadius: 22, overflow: 'hidden',
    borderWidth: 1.5, borderColor: colors.primary, alignItems: 'center', justifyContent: 'center',
  },
  otherAvatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  otherInitial: { color: '#0f0f0f', fontSize: 18, fontWeight: 'bold' },
  body: { flex: 1, marginLeft: 12 },
  name: { color: colors.textMuted, fontSize: 12, marginBottom: 2 },
  text: { color: colors.text, fontSize: 14, fontWeight: '600' },
  subtitle: { color: colors.gold, fontSize: 12, marginTop: 2 },
  time: { color: colors.textFaint, fontSize: 11, marginLeft: 8 },
  empty: { alignItems: 'center', paddingVertical: 60 },
  emptyEmoji: { fontSize: 44, marginBottom: 16 },
  emptyText: { color: colors.textMuted, fontSize: 14, textAlign: 'center', lineHeight: 22, paddingHorizontal: 20 },
});
