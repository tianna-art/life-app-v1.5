import { StyleSheet, Text } from 'react-native';
import { colors, fonts } from '@/theme';

/** The small label that sits above a block. */
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
    fontSize: 11,
    letterSpacing: 2.2,
    color: colors.brownFaint,
  },
});
