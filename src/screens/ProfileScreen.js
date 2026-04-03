import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, Alert
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ConfirmModal from '../components/ConfirmModal';

const LEVELS = ['Iniciante', 'Intermédio', 'Avançado'];

export default function ProfileScreen({ profile, onProfileUpdate, onReset }) {
  const [weight, setWeight] = useState(profile?.weight || '');
  const [height, setHeight] = useState(profile?.height || '');
  const [level, setLevel] = useState(profile?.level || 'Iniciante');
  const [saved, setSaved] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleSave = async () => {
    if (!weight || !height) {
      Alert.alert('Atenção', 'Preenche o peso e a altura.');
      return;
    }
    const updated = { weight, height, level };
    await AsyncStorage.setItem('userProfile', JSON.stringify(updated));
    onProfileUpdate(updated);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <>
      <ScrollView style={styles.container}>
        <Text style={styles.title}>O meu Perfil</Text>

        <View style={styles.card}>
          <Text style={styles.label}>Peso (kg)</Text>
          <TextInput
            style={styles.input}
            keyboardType="numeric"
            value={weight}
            onChangeText={setWeight}
            placeholder="ex: 78"
            placeholderTextColor="#555"
          />

          <Text style={styles.label}>Altura (cm)</Text>
          <TextInput
            style={styles.input}
            keyboardType="numeric"
            value={height}
            onChangeText={setHeight}
            placeholder="ex: 175"
            placeholderTextColor="#555"
          />

          <Text style={styles.label}>Nível de Fitness</Text>
          <View style={styles.levelContainer}>
            {LEVELS.map((l) => (
              <TouchableOpacity
                key={l}
                style={[styles.levelBtn, level === l && styles.levelBtnActive]}
                onPress={() => setLevel(l)}
              >
                <Text style={[styles.levelText, level === l && styles.levelTextActive]}>
                  {l}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
            <Text style={styles.saveBtnText}>
              {saved ? '✓ Guardado!' : 'Guardar alterações'}
            </Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.resetBtn} onPress={() => setShowConfirm(true)}>
          <Text style={styles.resetBtnText}>⚠ Resetar Tudo</Text>
        </TouchableOpacity>
      </ScrollView>

      <ConfirmModal
        visible={showConfirm}
        emoji="⚠️"
        title="Resetar tudo?"
        message="Isto apaga o teu plano, progresso e streak. Tens a certeza?"
        confirmText="Resetar"
        cancelText="Cancelar"
        confirmColor="#ef4444"
        onConfirm={() => { setShowConfirm(false); onReset(); }}
        onDismiss={() => setShowConfirm(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f0f', padding: 16 },
  title: { fontSize: 22, fontWeight: 'bold', color: '#ffffff', marginBottom: 20, marginTop: 40 },
  card: {
    backgroundColor: '#1e1e1e', borderRadius: 16,
    padding: 20, borderWidth: 1, borderColor: '#333', marginBottom: 16
  },
  label: { fontSize: 14, color: '#aaaaaa', marginBottom: 8, marginTop: 16 },
  input: {
    backgroundColor: '#2a2a2a', color: '#ffffff', borderRadius: 10,
    padding: 14, fontSize: 16, borderWidth: 1, borderColor: '#444'
  },
  levelContainer: { flexDirection: 'row', gap: 10, marginTop: 8 },
  levelBtn: {
    flex: 1, padding: 12, borderRadius: 10,
    backgroundColor: '#2a2a2a', borderWidth: 1, borderColor: '#444', alignItems: 'center'
  },
  levelBtnActive: { backgroundColor: '#4ade80', borderColor: '#4ade80' },
  levelText: { color: '#aaaaaa', fontWeight: '600' },
  levelTextActive: { color: '#000000' },
  saveBtn: {
    marginTop: 24, backgroundColor: '#4ade80',
    padding: 16, borderRadius: 14, alignItems: 'center'
  },
  saveBtnText: { fontSize: 16, fontWeight: 'bold', color: '#000000' },
  resetBtn: {
    marginTop: 8, marginBottom: 80, padding: 14,
    borderRadius: 12, borderWidth: 1, borderColor: '#ef4444', alignItems: 'center'
  },
  resetBtnText: { color: '#ef4444', fontSize: 15 },
});