import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts, spacing } from '@/theme';
import { Button } from './Button';
import { Screen } from './Screen';
import type { useAuth } from '@/hooks/useAuth';

type Auth = ReturnType<typeof useAuth>;

/**
 * The way in. One door.
 *
 * Email and password are gone: a second route only made the entrance a
 * decision, and it meant owning password reset, verification and change flows
 * for no gain. Supabase handles the credential; the app never sees it.
 */
export function AuthGate({ auth }: { auth: Auth }) {
  return (
    <Screen>
      <View style={styles.center}>
        <Text style={styles.brand}>crincran</Text>
        <Text style={styles.taglineJa}>夢に呼吸を。</Text>

        <View style={styles.form}>
          <Button
            testID="auth-google"
            label="Google ではじめる"
            variant="solid"
            onPress={() => void auth.signInWithGoogle()}
            disabled={auth.loading}
            accessibilityHint="Google アカウントでサインインします"
          />
          {auth.error ? <Text style={styles.error}>{auth.error}</Text> : null}
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', gap: spacing.xs },
  brand: { fontFamily: fonts.serif, fontSize: 38, letterSpacing: 1.5, color: colors.brown },
  taglineJa: { fontFamily: fonts.serif, fontSize: 14, color: colors.brownDim },
  form: { marginTop: spacing.xl, gap: spacing.md },
  error: { fontFamily: fonts.sans, fontSize: 12, color: colors.danger },
});
