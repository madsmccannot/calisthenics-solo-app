import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform
} from 'react-native';
import { colors, radius } from '../theme';
import { signInWithIdentifier, signUp, passwordIssues, passwordStrong, friendlyAuthError } from '../services/auth';

export default function AuthScreen({ onAuthed }) {
  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [email, setEmail] = useState(''); // no login pode ser email OU nome
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const isRegister = mode === 'register';
  const issues = passwordIssues(password);
  const canSubmit = isRegister
    ? email.includes('@') && passwordStrong(password)
    : email.trim().length > 0 && password.length > 0;

  const submit = async () => {
    setError('');
    setNotice('');
    setLoading(true);
    try {
      if (isRegister) {
        const { session, needsConfirmation, error } = await signUp(email, password);
        if (error) setError(friendlyAuthError(error));
        else if (needsConfirmation) setNotice('Conta criada! Confirma o teu email e depois entra.');
        else if (session) onAuthed(session, true); // registo -> conta nova (nome vem depois)
      } else {
        const { session, error } = await signInWithIdentifier(email, password);
        if (error) setError(friendlyAuthError(error));
        else if (session) onAuthed(session, false); // login -> puxa dados da conta
      }
    } catch (e) {
      setError('Algo correu mal. Tenta de novo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.logo}>💪</Text>
        <Text style={styles.title}>Calisthenics Solo</Text>
        <Text style={styles.subtitle}>
          {isRegister ? 'Cria a tua conta' : 'Entra na tua conta'}
        </Text>

        {/* Social só no login — no registo escondemos para os campos subirem
            e não ficarem tapados pelo teclado */}
        {!isRegister && (
          <>
            <TouchableOpacity style={styles.socialBtn} disabled onPress={() => {}}>
              <Text style={styles.socialText}>Continuar com Google</Text>
              <Text style={styles.soon}>brevemente</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.socialBtn} disabled onPress={() => {}}>
              <Text style={styles.socialText}>Continuar com Apple</Text>
              <Text style={styles.soon}>brevemente</Text>
            </TouchableOpacity>

            <View style={styles.divider}>
              <View style={styles.line} />
              <Text style={styles.dividerText}>ou com email</Text>
              <View style={styles.line} />
            </View>
          </>
        )}

        <TextInput
          style={styles.input}
          placeholder={isRegister ? 'Email' : 'Email ou nome de utilizador'}
          placeholderTextColor={colors.textDim}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType={isRegister ? 'email-address' : 'default'}
          value={email}
          onChangeText={setEmail}
        />
        <View style={styles.pwRow}>
          <TextInput
            style={styles.pwInput}
            placeholder="Password"
            placeholderTextColor={colors.textDim}
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            value={password}
            onChangeText={setPassword}
          />
          <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowPassword((v) => !v)}>
            <Text style={styles.eyeText}>{showPassword ? '🙈' : '👁️'}</Text>
          </TouchableOpacity>
        </View>

        {isRegister && password.length > 0 && (
          <View style={styles.reqBox}>
            {['pelo menos 8 caracteres', 'uma letra minúscula', 'uma letra maiúscula', 'um número'].map((req) => {
              const ok = !issues.includes(req);
              return (
                <Text key={req} style={[styles.req, ok && styles.reqOk]}>
                  {ok ? '✓' : '○'} {req}
                </Text>
              );
            })}
          </View>
        )}

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {notice ? <Text style={styles.notice}>{notice}</Text> : null}

        <TouchableOpacity
          style={[styles.submitBtn, !canSubmit && styles.submitDisabled]}
          onPress={submit}
          disabled={!canSubmit || loading}
        >
          {loading ? (
            <ActivityIndicator color={colors.onPrimary} />
          ) : (
            <Text style={styles.submitText}>{isRegister ? 'Criar conta' : 'Entrar'}</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => { setMode(isRegister ? 'login' : 'register'); setError(''); setNotice(''); }}
        >
          <Text style={styles.switch}>
            {isRegister ? 'Já tens conta? Entra' : 'Ainda não tens conta? Regista-te'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, justifyContent: 'center', padding: 28 },
  logo: { fontSize: 56, textAlign: 'center', marginBottom: 8 },
  title: { fontSize: 26, fontWeight: 'bold', color: colors.text, textAlign: 'center' },
  subtitle: { fontSize: 15, color: colors.textMuted, textAlign: 'center', marginTop: 6, marginBottom: 28 },
  socialBtn: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8,
    backgroundColor: colors.card, borderRadius: radius.lg, padding: 14, marginBottom: 10,
    borderWidth: 1, borderColor: colors.border, opacity: 0.6,
  },
  socialText: { color: colors.text, fontSize: 15, fontWeight: '600' },
  soon: { color: colors.textFaint, fontSize: 11 },
  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: 20 },
  line: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText: { color: colors.textFaint, fontSize: 12, marginHorizontal: 12 },
  input: {
    backgroundColor: colors.card, color: colors.text, borderRadius: radius.lg,
    padding: 16, fontSize: 16, borderWidth: 1, borderColor: colors.border, marginBottom: 12,
  },
  pwRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card,
    borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, marginBottom: 12,
  },
  pwInput: { flex: 1, color: colors.text, padding: 16, fontSize: 16 },
  eyeBtn: { paddingHorizontal: 16, paddingVertical: 12 },
  eyeText: { fontSize: 20 },
  reqBox: { marginBottom: 12, marginTop: 2 },
  req: { color: colors.textFaint, fontSize: 12, lineHeight: 20 },
  reqOk: { color: colors.primary },
  error: { color: colors.red, fontSize: 14, textAlign: 'center', marginBottom: 12 },
  notice: { color: colors.primary, fontSize: 14, textAlign: 'center', marginBottom: 12 },
  submitBtn: {
    backgroundColor: colors.primary, borderRadius: radius.lg, padding: 16,
    alignItems: 'center', marginTop: 4,
  },
  submitDisabled: { backgroundColor: colors.cardInner },
  submitText: { color: colors.onPrimary, fontSize: 16, fontWeight: 'bold' },
  switch: { color: colors.textMuted, fontSize: 14, textAlign: 'center', marginTop: 20 },
});
