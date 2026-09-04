import { StyleSheet, Text } from 'react-native';
import { colors, fonts } from '@/theme';

/** `SEPTEMBER 2026` — the museum plaque line. */
export function Eyebrow({ children }: { children: string }) {
  return (
    <Text style={styles.text} accessibilityRole="header">
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  text: {
    fontFamily: fonts.sans,
    fontSize: 12,
    letterSpacing: 3.4,
    color: colors.brassDim,
  },
});
