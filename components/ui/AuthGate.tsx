import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, fonts, radii, spacing } from '@/theme';
import { BrassButton } from './BrassButton';
import { Screen } from './Screen';
import type { useAuth } from '@/hooks/useAuth';

type Auth = ReturnType<typeof useAuth>;

/**
 * Sign-in gate. Deliberately quiet: a plaque, an email, a password.
 * Supabase Auth handles the credentials; the app stores nothing itself.
 */
export function AuthGate({ auth }: { auth: Auth }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'signIn' | 'signUp'>('signIn');

  return (
    <Screen>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.center}
      >
        <Text style={styles.brand}>crincran</Text>
        <Text style={styles.tagline}>KEEP THE DREAM BREATHING.</Text>
        <Text style={styles.taglineJa}>夢に呼吸を。</Text>

        <View style={styles.form}>
          <TextInput
            testID="auth-email"
            value={email}
            onChangeText={setEmail}
            placeholder="email"
            placeholderTextColor={colors.ivoryFaint}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            accessibilityLabel="メールアドレス"
            style={styles.input}
          />
          <TextInput
            testID="auth-password"
            value={password}
            onChangeText={setPassword}
            placeholder="password"
            placeholderTextColor={colors.ivoryFaint}
            secureTextEntry
            accessibilityLabel="パスワード"
            style={styles.input}
          />
          {auth.error ? <Text style={styles.error}>{auth.error}</Text> : null}
          <BrassButton
            testID="auth-submit"
            label={mode === 'signIn' ? 'はじめる' : 'アカウントをつくる'}
            variant="solid"
            onPress={() => {
              if (mode === 'signIn') void auth.signIn(email.trim(), password);
              else void auth.signUp(email.trim(), password);
            }}
            disabled={auth.loading || email.trim().length === 0 || password.length === 0}
          />
          <BrassButton
            label={mode === 'signIn' ? 'アカウントを持っていない' : 'ログインに戻る'}
            variant="quiet"
            onPress={() => setMode(mode === 'signIn' ? 'signUp' : 'signIn')}
          />
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', gap: spacing.sm },
  brand: { fontFamily: fonts.serif, fontSize: 38, letterSpacing: 2, color: colors.ivory },
  tagline: {
    fontFamily: fonts.sans,
    fontSize: 11,
    letterSpacing: 3.2,
    color: colors.brassDim,
    marginTop: spacing.sm,
  },
  taglineJa: { fontFamily: fonts.serif, fontSize: 14, color: colors.ivoryFaint },
  form: { marginTop: spacing.xl, gap: spacing.md },
  input: {
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.frame,
    color: colors.ivory,
    fontFamily: fonts.sans,
    fontSize: 16,
  },
  error: { fontFamily: fonts.sans, fontSize: 12, color: colors.danger },
});
