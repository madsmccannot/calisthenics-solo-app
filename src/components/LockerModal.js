import React, { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Modal, ScrollView
} from 'react-native';
import { colors, radius } from '../theme';
import Avatar from './Avatar';
import { CATEGORIES, itemsBySlot } from '../config/shopCatalog';
import { getLockerState, buyItem, equipItem } from '../services/progressStore';

// Loja + aparência num só ecrã: compra com moedas e equipa. Itens grátis já
// vêm desbloqueados; comprar equipa logo.
export default function LockerModal({ visible, onClose, onChanged }) {
  const [locker, setLocker] = useState(null);
  const [activeSlot, setActiveSlot] = useState('skin');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (visible) {
      load();
      setActiveSlot('skin');
      setNotice('');
    }
  }, [visible]);

  const load = async () => setLocker(await getLockerState());

  const handleItem = async (item) => {
    if (!locker) return;
    const owned = locker.owned.includes(item.id);
    if (owned) {
      await equipItem(item.slot, item.id);
    } else {
      const res = await buyItem(item.id);
      if (!res.ok) {
        setNotice(res.reason === 'coins' ? 'Moedas insuficientes' : '');
        return;
      }
      setNotice('');
    }
    await load();
    onChanged?.();
  };

  if (!locker) {
    return (
      <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose} />
    );
  }

  const items = itemsBySlot(activeSlot);

  return (
    <Modal transparent visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>Aparência & Loja</Text>
            <View style={styles.coinPill}>
              <Text style={styles.coinText}>🪙 {locker.coins}</Text>
            </View>
          </View>

          <View style={styles.previewRow}>
            <Avatar avatar={locker.avatar} size={120} />
          </View>

          {/* separadores de slot */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tabs}
          >
            {CATEGORIES.map((c) => (
              <TouchableOpacity
                key={c.slot}
                style={[styles.tab, activeSlot === c.slot && styles.tabActive]}
                onPress={() => { setActiveSlot(c.slot); setNotice(''); }}
              >
                <Text style={[styles.tabText, activeSlot === c.slot && styles.tabTextActive]}>
                  {c.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {notice ? <Text style={styles.notice}>{notice}</Text> : null}

          {/* grelha de itens do slot ativo */}
          <ScrollView contentContainerStyle={styles.grid}>
            {items.map((item) => {
              const owned = locker.owned.includes(item.id);
              const equipped = locker.avatar[item.slot] === item.id;
              const affordable = locker.coins >= item.cost;
              return (
                <TouchableOpacity
                  key={item.id}
                  style={[styles.item, equipped && styles.itemEquipped]}
                  onPress={() => handleItem(item)}
                  activeOpacity={0.7}
                >
                  <Swatch item={item} />
                  <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
                  {equipped ? (
                    <Text style={styles.equipped}>Equipado</Text>
                  ) : owned ? (
                    <Text style={styles.equip}>Equipar</Text>
                  ) : (
                    <Text style={[styles.cost, !affordable && styles.costLocked]}>
                      🪙 {item.cost}
                    </Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeText}>Fechar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function Swatch({ item }) {
  if (item.value === 'none') {
    return <View style={[styles.swatch, styles.swatchNone]}><Text style={styles.swatchNoneText}>∅</Text></View>;
  }
  if (typeof item.value === 'string' && item.value.startsWith('#')) {
    return <View style={[styles.swatch, { backgroundColor: item.value }]} />;
  }
  // estilos de cabelo (short/mohawk)
  const label = item.value === 'mohawk' ? '⑄' : '≈';
  return <View style={[styles.swatch, styles.swatchStyle]}><Text style={styles.swatchStyleText}>{label}</Text></View>;
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: radius.round,
    borderTopRightRadius: radius.round,
    padding: 20,
    paddingBottom: 34,
    maxHeight: '88%',
    borderWidth: 1,
    borderColor: colors.border,
  },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12,
  },
  title: { color: colors.text, fontSize: 20, fontWeight: 'bold' },
  coinPill: {
    backgroundColor: colors.card, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 6,
    borderWidth: 1, borderColor: colors.gold,
  },
  coinText: { color: colors.gold, fontWeight: 'bold', fontSize: 14 },
  previewRow: { alignItems: 'center', marginBottom: 12 },
  tabs: { gap: 8, paddingVertical: 4 },
  tab: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.md,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
  },
  tabActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  tabText: { color: colors.textMuted, fontWeight: '600', fontSize: 13 },
  tabTextActive: { color: colors.onPrimary },
  notice: { color: colors.red, fontSize: 13, textAlign: 'center', marginTop: 10 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingVertical: 14 },
  item: {
    width: '30.5%', backgroundColor: colors.card, borderRadius: radius.md,
    padding: 10, alignItems: 'center', borderWidth: 1.5, borderColor: colors.border,
  },
  itemEquipped: { borderColor: colors.primary },
  swatch: {
    width: 44, height: 44, borderRadius: 22, marginBottom: 8,
    borderWidth: 1, borderColor: colors.border,
  },
  swatchNone: { backgroundColor: colors.cardInner, alignItems: 'center', justifyContent: 'center' },
  swatchNoneText: { color: colors.textFaint, fontSize: 18 },
  swatchStyle: { backgroundColor: colors.cardInner, alignItems: 'center', justifyContent: 'center' },
  swatchStyleText: { color: colors.text, fontSize: 20 },
  itemName: { color: colors.text, fontSize: 12, marginBottom: 4 },
  equipped: { color: colors.primary, fontSize: 11, fontWeight: 'bold' },
  equip: { color: colors.textMuted, fontSize: 11 },
  cost: { color: colors.gold, fontSize: 12, fontWeight: 'bold' },
  costLocked: { color: colors.textFaint },
  closeBtn: {
    padding: 14, borderRadius: radius.lg, alignItems: 'center',
    borderWidth: 1, borderColor: colors.border, marginTop: 8,
  },
  closeText: { color: colors.textMuted, fontSize: 15 },
});
