import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts, spacing } from '@/theme';

/**
 * Empty is never framed as a shortfall. The copy comes from constants/copy.ts
 * so the forbidden phrasing cannot reappear.
 */
export function EmptyState({ message }: { message: string }) {
  return (
    <View style={styles.wrap} accessibilityRole="text">
      <Text style={styles.text}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
  },
  text: {
    fontFamily: fonts.serif,
    fontSize: 15,
    lineHeight: 26,
    textAlign: 'center',
    color: colors.ivoryFaint,
  },
});
