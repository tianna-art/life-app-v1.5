import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { HIT_SLOP, colors, fonts, radii, spacing } from '@/theme';
import { BrassButton } from './BrassButton';
import { Screen } from './Screen';
import { HairlineRule } from './HairlineRule';
import type { useAuth } from '@/hooks/useAuth';

type Auth = ReturnType<typeof useAuth>;

/**
 * Sign-in gate. Deliberately quiet: a plaque, then the shortest way in.
 * Supabase Auth handles every credential; the app stores none of them itself.
 */
export function AuthGate({ auth }: { auth: Auth }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'signIn' | 'signUp'>('signIn');
  const [emailOpen, setEmailOpen] = useState(false);

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
          <BrassButton
            testID="auth-google"
            label="Google で続ける"
            variant="solid"
            onPress={() => void auth.signInWithGoogle()}
            disabled={auth.loading}
            accessibilityHint="Google アカウントでサインインします"
          />

          {auth.error ? <Text style={styles.error}>{auth.error}</Text> : null}

          {emailOpen ? (
            <View style={styles.emailBlock}>
              <HairlineRule />
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
              <BrassButton
                testID="auth-submit"
                label={mode === 'signIn' ? 'メールではじめる' : 'アカウントをつくる'}
                onPress={() => {
                  if (mode === 'signIn') void auth.signIn(email.trim(), password);
                  else void auth.signUp(email.trim(), password);
                }}
                disabled={auth.loading || email.trim().length === 0 || password.length === 0}
              />
              <Pressable
                onPress={() => setMode(mode === 'signIn' ? 'signUp' : 'signIn')}
                hitSlop={HIT_SLOP}
                accessibilityRole="button"
                accessibilityLabel={
                  mode === 'signIn' ? 'アカウントを持っていない' : 'ログインに戻る'
                }
                style={styles.quietRow}
              >
                <Text style={styles.quiet}>
                  {mode === 'signIn' ? 'アカウントを持っていない' : 'ログインに戻る'}
                </Text>
              </Pressable>
            </View>
          ) : (
            <Pressable
              testID="auth-open-email"
              onPress={() => setEmailOpen(true)}
              hitSlop={HIT_SLOP}
              accessibilityRole="button"
              accessibilityLabel="メールアドレスでログイン"
              style={styles.quietRow}
            >
              <Text style={styles.quiet}>メールアドレスでログイン</Text>
            </Pressable>
          )}
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
  emailBlock: { gap: spacing.md },
  input: {
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.frame,
    color: colors.ivory,
    fontFamily: fonts.sans,
    fontSize: 16,
  },
  quietRow: { alignItems: 'center', paddingVertical: spacing.sm },
  quiet: { fontFamily: fonts.sans, fontSize: 13, color: colors.ivoryFaint },
  error: { fontFamily: fonts.sans, fontSize: 12, color: colors.danger },
});
