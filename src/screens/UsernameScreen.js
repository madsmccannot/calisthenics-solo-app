import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, KeyboardAvoidingView, Platform
} from 'react-native';
import { colors, radius } from '../theme';
import { claimUsername } from '../services/cloudSync';

// Pedida após criar conta (email ou OAuth), quando ainda não há nome definido.
// O nome é único e é o que aparece para outros no feed.
const RE = /^[a-zA-Z0-9_.]{3,20}$/;

export default function UsernameScreen({ onDone }) {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const valid = RE.test(name.trim());

  const submit = async () => {
    setError('');
    setLoading(true);
    const res = await claimUsername(name);
    setLoading(false);
    if (res.ok) {
      onDone(name.trim());
    } else if (res.reason === 'taken') {
      setError('Esse nome já está em uso. Escolhe outro.');
    } else {
      setError('Não foi possível guardar. Verifica a ligação e tenta de novo.');
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.container}>
        <Text style={styles.logo}>👋</Text>
        <Text style={styles.title}>Escolhe um nome</Text>
        <Text style={styles.subtitle}>
          É o nome que os outros vão ver no feed. Podes mudá-lo depois.
        </Text>

        <TextInput
          style={styles.input}
          placeholder="nome de utilizador"
          placeholderTextColor={colors.textDim}
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={20}
          value={name}
          onChangeText={setName}
        />
        <Text style={styles.hint}>3 a 20 caracteres · letras, números, _ ou .</Text>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TouchableOpacity
          style={[styles.btn, !valid && styles.btnDisabled]}
          onPress={submit}
          disabled={!valid || loading}
        >
          {loading ? (
            <ActivityIndicator color={colors.onPrimary} />
          ) : (
            <Text style={styles.btnText}>Continuar</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 28 },
  logo: { fontSize: 52, textAlign: 'center', marginBottom: 8 },
  title: { fontSize: 26, fontWeight: 'bold', color: colors.text, textAlign: 'center' },
  subtitle: { fontSize: 14, color: colors.textMuted, textAlign: 'center', marginTop: 8, marginBottom: 28, lineHeight: 20 },
  input: {
    backgroundColor: colors.card, color: colors.text, borderRadius: radius.lg,
    padding: 16, fontSize: 16, borderWidth: 1, borderColor: colors.border,
  },
  hint: { color: colors.textFaint, fontSize: 12, marginTop: 8, marginLeft: 4 },
  error: { color: colors.red, fontSize: 14, textAlign: 'center', marginTop: 14 },
  btn: { backgroundColor: colors.primary, borderRadius: radius.lg, padding: 16, alignItems: 'center', marginTop: 24 },
  btnDisabled: { backgroundColor: colors.cardInner },
  btnText: { color: colors.onPrimary, fontSize: 16, fontWeight: 'bold' },
});
