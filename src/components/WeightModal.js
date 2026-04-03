import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Modal, ScrollView
} from 'react-native';
import ConfirmModal from './ConfirmModal';

export default function WeightModal({ visible, onSave, onDelete, onDismiss, entries }) {
  const [weight, setWeight] = useState('');
  const [mode, setMode] = useState('add');
  const [entryToDelete, setEntryToDelete] = useState(null);

  useEffect(() => {
    if (!visible) {
      setWeight('');
      setMode('add');
      setEntryToDelete(null);
    }
  }, [visible]);

  const handleSave = () => {
    if (!weight || isNaN(parseFloat(weight))) return;
    onSave(parseFloat(weight));
    setWeight('');
  };

  const getBmiColor = (w) => {
    if (!entries || entries.length === 0) return '#aaaaaa';
    const heightM = entries[0]?.heightM;
    if (!heightM) return '#aaaaaa';
    const bmi = w / (heightM * heightM);
    if (bmi < 18.5) return '#3b82f6';
    if (bmi < 25) return '#4ade80';
    if (bmi < 30) return '#f97316';
    return '#ef4444';
  };

  return (
    <>
      <Modal transparent visible={visible} animationType="fade" onRequestClose={onDismiss}>
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <View style={styles.tabRow}>
              <TouchableOpacity
                style={[styles.tab, mode === 'add' && styles.tabActive]}
                onPress={() => setMode('add')}
              >
                <Text style={[styles.tabText, mode === 'add' && styles.tabTextActive]}>
                  + Registar
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tab, mode === 'manage' && styles.tabActive]}
                onPress={() => setMode('manage')}
              >
                <Text style={[styles.tabText, mode === 'manage' && styles.tabTextActive]}>
                  Gerir registos
                </Text>
              </TouchableOpacity>
            </View>

            {mode === 'add' ? (
              <>
                <Text style={styles.emoji}>⚖️</Text>
                <Text style={styles.title}>Registar Peso</Text>
                <Text style={styles.subtitle}>Como estás hoje?</Text>
                <TextInput
                  style={styles.input}
                  keyboardType="numeric"
                  placeholder="ex: 76.5"
                  placeholderTextColor="#555"
                  value={weight}
                  onChangeText={setWeight}
                  autoFocus
                />
                <Text style={styles.unit}>kg</Text>
                <TouchableOpacity
                  style={[styles.saveBtn, !weight && styles.saveBtnDisabled]}
                  onPress={handleSave}
                  disabled={!weight}
                >
                  <Text style={styles.saveBtnText}>Guardar</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={styles.manageTitle}>Os teus registos</Text>
                <ScrollView style={styles.entriesList}>
                  {entries && entries.length > 0 ? (
                    [...entries].reverse().map((entry, i) => (
                      <View key={i} style={styles.entryRow}>
                        <View style={[styles.entryDot, { backgroundColor: getBmiColor(entry.weight) }]} />
                        <View style={styles.entryInfo}>
                          <Text style={styles.entryDate}>{entry.date}</Text>
                          <Text style={[styles.entryWeight, { color: getBmiColor(entry.weight) }]}>
                            {entry.weight} kg
                          </Text>
                        </View>
                        <TouchableOpacity
                          style={styles.deleteBtn}
                          onPress={() => setEntryToDelete(entry)}
                        >
                          <Text style={styles.deleteBtnText}>🗑</Text>
                        </TouchableOpacity>
                      </View>
                    ))
                  ) : (
                    <Text style={styles.emptyText}>Ainda não tens registos.</Text>
                  )}
                </ScrollView>
              </>
            )}

            <TouchableOpacity style={styles.dismissBtn} onPress={onDismiss}>
              <Text style={styles.dismissBtnText}>Fechar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <ConfirmModal
        visible={!!entryToDelete}
        emoji="🗑️"
        title="Remover registo?"
        message={entryToDelete ? `Tens a certeza que queres remover o registo de ${entryToDelete.weight}kg do dia ${entryToDelete.date}?` : ''}
        confirmText="Remover"
        cancelText="Cancelar"
        confirmColor="#ef4444"
        onConfirm={() => {
          onDelete(entryToDelete);
          setEntryToDelete(null);
        }}
        onDismiss={() => setEntryToDelete(null)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center', alignItems: 'center', padding: 32
  },
  modal: {
    backgroundColor: '#1e1e1e', borderRadius: 24, padding: 24,
    width: '100%', borderWidth: 1, borderColor: '#333', alignItems: 'center',
    maxHeight: '80%'
  },
  tabRow: {
    flexDirection: 'row', backgroundColor: '#2a2a2a',
    borderRadius: 10, padding: 4, width: '100%', marginBottom: 20
  },
  tab: { flex: 1, padding: 8, borderRadius: 8, alignItems: 'center' },
  tabActive: { backgroundColor: '#4ade80' },
  tabText: { color: '#aaaaaa', fontWeight: '600', fontSize: 13 },
  tabTextActive: { color: '#000000' },
  emoji: { fontSize: 48, marginBottom: 12 },
  title: { fontSize: 22, fontWeight: 'bold', color: '#ffffff', marginBottom: 4 },
  subtitle: { color: '#aaaaaa', fontSize: 15, marginBottom: 24 },
  input: {
    backgroundColor: '#2a2a2a', color: '#ffffff', borderRadius: 12,
    padding: 16, fontSize: 28, fontWeight: 'bold', textAlign: 'center',
    borderWidth: 1, borderColor: '#444', width: '100%', marginBottom: 4
  },
  unit: { color: '#aaaaaa', fontSize: 14, marginBottom: 24 },
  saveBtn: {
    width: '100%', backgroundColor: '#4ade80',
    padding: 16, borderRadius: 14, alignItems: 'center', marginBottom: 10
  },
  saveBtnDisabled: { backgroundColor: '#2a2a2a' },
  saveBtnText: { fontSize: 16, fontWeight: 'bold', color: '#000000' },
  manageTitle: {
    fontSize: 18, fontWeight: 'bold', color: '#ffffff',
    marginBottom: 16, alignSelf: 'flex-start'
  },
  entriesList: { width: '100%', maxHeight: 280 },
  entryRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#2a2a2a'
  },
  entryDot: { width: 10, height: 10, borderRadius: 5, marginRight: 12 },
  entryInfo: { flex: 1 },
  entryDate: { color: '#aaaaaa', fontSize: 12 },
  entryWeight: { fontSize: 18, fontWeight: 'bold', marginTop: 2 },
  deleteBtn: { padding: 8 },
  deleteBtnText: { fontSize: 20 },
  emptyText: { color: '#aaaaaa', textAlign: 'center', paddingVertical: 20 },
  dismissBtn: {
    width: '100%', padding: 14, borderRadius: 14, marginTop: 12,
    alignItems: 'center', borderWidth: 1, borderColor: '#333'
  },
  dismissBtnText: { color: '#aaaaaa', fontSize: 15 },
});