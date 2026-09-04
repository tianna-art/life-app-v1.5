import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, fonts, spacing } from '@/theme';
import { Screen } from '@components/ui/Screen';
import { BrassButton } from '@components/ui/BrassButton';

/**
 * A single quiet plate. No goals to set, no categories to fill in — the user
 * starts by leaving one point, not by configuring an app.
 */
export default function OnboardingScreen() {
  const router = useRouter();
  return (
    <Screen>
      <View style={styles.center}>
        <Text style={styles.brand}>crincran</Text>
        <Text style={styles.tagline}>KEEP THE DREAM BREATHING.</Text>
        <Text style={styles.taglineJa}>夢に呼吸を。</Text>
        <Text style={styles.body}>
          日々の出来事とつぶやきを、軽く残していく場所です。{'\n'}
          残した点は、あとから星図として見えてきます。
        </Text>
        <BrassButton label="はじめる" variant="solid" onPress={() => router.replace('/log')} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', gap: spacing.md },
  brand: { fontFamily: fonts.serif, fontSize: 40, letterSpacing: 2, color: colors.ivory },
  tagline: { fontFamily: fonts.sans, fontSize: 11, letterSpacing: 3.2, color: colors.brassDim },
  taglineJa: { fontFamily: fonts.serif, fontSize: 15, color: colors.ivoryFaint },
  body: {
    fontFamily: fonts.sans,
    fontSize: 14,
    lineHeight: 24,
    color: colors.ivoryDim,
    marginTop: spacing.lg,
    marginBottom: spacing.lg,
  },
});
