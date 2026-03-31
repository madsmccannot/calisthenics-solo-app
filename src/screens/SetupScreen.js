import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, Alert
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { scheduleDailyReminder } from '../services/notificationService';

const LEVELS = ['Iniciante', 'Intermédio', 'Avançado'];

export default function SetupScreen({ onSetupComplete }) {
  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('');
  const [level, setLevel] = useState('Iniciante');

  const handleStart = async () => {
    if (!weight || !height) {
      Alert.alert('Atenção', 'Preenche o peso e a altura.');
      return;
    }

    const profile = { weight, height, level };
    await AsyncStorage.setItem('userProfile', JSON.stringify(profile));
    await scheduleDailyReminder(9, 0); // Notificação todos os dias às 9:00
    onSetupComplete(profile);
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Configura o teu Perfil</Text>

      <Text style={styles.label}>Peso (kg)</Text>
      <TextInput
        style={styles.input}
        keyboardType="numeric"
        placeholder="ex: 78"
        value={weight}
        onChangeText={setWeight}
      />

      <Text style={styles.label}>Altura (cm)</Text>
      <TextInput
        style={styles.input}
        keyboardType="numeric"
        placeholder="ex: 175"
        value={height}
        onChangeText={setHeight}
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

      <TouchableOpacity style={styles.startBtn} onPress={handleStart}>
        <Text style={styles.startBtnText}>Começar →</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 24, backgroundColor: '#0f0f0f', justifyContent: 'center' },
  title: { fontSize: 28, fontWeight: 'bold', color: '#ffffff', marginBottom: 32, textAlign: 'center' },
  label: { fontSize: 14, color: '#aaaaaa', marginBottom: 8, marginTop: 16 },
  input: {
    backgroundColor: '#1e1e1e', color: '#ffffff', borderRadius: 10,
    padding: 14, fontSize: 16, borderWidth: 1, borderColor: '#333'
  },
  levelContainer: { flexDirection: 'row', gap: 10, marginTop: 8 },
  levelBtn: {
    flex: 1, padding: 12, borderRadius: 10,
    backgroundColor: '#1e1e1e', borderWidth: 1, borderColor: '#333', alignItems: 'center'
  },
  levelBtnActive: { backgroundColor: '#4ade80', borderColor: '#4ade80' },
  levelText: { color: '#aaaaaa', fontWeight: '600' },
  levelTextActive: { color: '#000000' },
  startBtn: {
    marginTop: 40, backgroundColor: '#4ade80', padding: 16,
    borderRadius: 14, alignItems: 'center'
  },
  startBtnText: { fontSize: 18, fontWeight: 'bold', color: '#000000' },
});