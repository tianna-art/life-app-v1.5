import { StyleSheet, Text } from 'react-native';
import { colors, fonts, spacing } from '@/theme';

/**
 * One light question, chosen at random for the selected category.
 * It is guidance, never a requirement.
 */
export function CategoryPrompt({ prompt }: { prompt: string | null }) {
  if (!prompt) return null;
  return (
    <Text style={styles.text} accessibilityRole="text" testID="category-prompt">
      {prompt}
    </Text>
  );
}

const styles = StyleSheet.create({
  text: {
    fontFamily: fonts.serifItalic,
    fontStyle: 'italic',
    fontSize: 14,
    lineHeight: 22,
    color: colors.brassDim,
    marginTop: spacing.sm,
  },
});
