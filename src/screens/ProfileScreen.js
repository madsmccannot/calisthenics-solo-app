import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, Modal, ActivityIndicator
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ConfirmModal from '../components/ConfirmModal';
import InfoModal from '../components/InfoModal';
import { getRegenerableCount, regenerateFuturePlan, getPlanClass } from '../services/planService';

const LEVELS = ['Iniciante', 'Intermédio', 'Avançado'];

export default function ProfileScreen({ profile, onProfileUpdate, onReset, onPlanChanged, activeTab }) {
  const [weight, setWeight] = useState(profile?.weight || '');
  const [height, setHeight] = useState(profile?.height || '');
  const [level, setLevel] = useState(profile?.level || 'Iniciante');
  const [saved, setSaved] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showRegenConfirm, setShowRegenConfirm] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [planClass, setPlanClass] = useState(null); // classe com que o plano foi gerado
  const [regenCount, setRegenCount] = useState(0); // dias futuros regeneráveis
  const [info, setInfo] = useState(null); // { emoji, title, message } para o InfoModal

  useEffect(() => {
    if (activeTab === undefined || activeTab === 'profile') loadPlanInfo();
  }, [activeTab]);

  const loadPlanInfo = async () => {
    setPlanClass(await getPlanClass()); // null se o plano é antigo (sem registo)
    setRegenCount(await getRegenerableCount());
  };

  // Difere se a classe escolhida != a do plano (ou se o plano é antigo/desconhecido).
  const loadDiffers = level !== planClass && regenCount > 0;

  const handleSave = async () => {
    if (!weight || !height) {
      setInfo({ emoji: '⚠️', title: 'Falta informação', message: 'Preenche o peso e a altura.' });
      return;
    }
    const updated = { weight, height, level };
    await AsyncStorage.setItem('userProfile', JSON.stringify(updated));
    onProfileUpdate(updated);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleRegenConfirm = async () => {
    setShowRegenConfirm(false);
    setRegenerating(true);
    // garante que o perfil guardado reflete a classe antes de regenerar
    const updated = { weight, height, level };
    await AsyncStorage.setItem('userProfile', JSON.stringify(updated));
    onProfileUpdate(updated);
    const { changed } = await regenerateFuturePlan(updated);
    setPlanClass(level);
    setRegenCount(await getRegenerableCount());
    setRegenerating(false);
    onPlanChanged?.();
    if (changed > 0) {
      setInfo({
        emoji: '✅',
        title: 'Treinos atualizados',
        message: `${changed} treinos por fazer foram regerados com a carga de ${level}.`,
      });
    } else {
      setInfo({
        emoji: '📡',
        title: 'Nada foi alterado',
        message: 'A IA não respondeu a tempo. Verifica a ligação e tenta de novo.',
      });
    }
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

          {loadDiffers && (
            <TouchableOpacity
              style={styles.applyLoadBtn}
              onPress={() => setShowRegenConfirm(true)}
            >
              <Text style={styles.applyLoadText}>
                ⚡ Aplicar carga de {level} aos {regenCount} treinos por fazer
              </Text>
              <Text style={styles.applyLoadSub}>
                {planClass
                  ? `Plano atual gerado com carga de ${planClass}`
                  : 'Aplica a carga atual ao teu plano existente'}
              </Text>
            </TouchableOpacity>
          )}
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

      <ConfirmModal
        visible={showRegenConfirm}
        emoji="⚡"
        title="Mudaste de classe"
        message={`Queres regenerar os ${regenCount} treinos por fazer com a nova carga? Isto usa a IA e pode demorar 1-2 minutos. Os dias já feitos não são afetados.`}
        confirmText="Regenerar"
        cancelText="Manter como está"
        confirmColor="#4ade80"
        onConfirm={handleRegenConfirm}
        onDismiss={() => setShowRegenConfirm(false)}
      />

      <Modal transparent visible={regenerating} animationType="fade">
        <View style={styles.regenOverlay}>
          <View style={styles.regenBox}>
            <ActivityIndicator size="large" color="#4ade80" />
            <Text style={styles.regenTitle}>A regenerar os treinos...</Text>
            <Text style={styles.regenSub}>Com a nova carga · pode demorar 1-2 min</Text>
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
  applyLoadBtn: {
    marginTop: 12, backgroundColor: '#2a2a2a', padding: 14,
    borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: '#fbbf24'
  },
  applyLoadText: { color: '#fbbf24', fontSize: 14, fontWeight: 'bold', textAlign: 'center' },
  applyLoadSub: { color: '#aaaaaa', fontSize: 11, marginTop: 4, textAlign: 'center' },
  resetBtn: {
    marginTop: 8, marginBottom: 80, padding: 14,
    borderRadius: 12, borderWidth: 1, borderColor: '#ef4444', alignItems: 'center'
  },
  resetBtnText: { color: '#ef4444', fontSize: 15 },
  regenOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center', alignItems: 'center', padding: 32
  },
  regenBox: {
    backgroundColor: '#1e1e1e', borderRadius: 24, padding: 32,
    alignItems: 'center', borderWidth: 1, borderColor: '#333', width: '100%'
  },
  regenTitle: { color: '#ffffff', fontSize: 18, fontWeight: 'bold', marginTop: 20, textAlign: 'center' },
  regenSub: { color: '#aaaaaa', fontSize: 13, marginTop: 8, textAlign: 'center' },
});