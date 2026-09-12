import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, spacing } from '@/theme';
import { Screen } from '@components/ui/Screen';

/**
 * 入力 — ひとこと記録 / 未来メモ / 感情クエスト.
 *
 * Phase 2 builds ひとこと記録 and 未来メモ; Phase 5 builds 感情クエスト.
 */
export default function LogScreen() {
  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <Text style={styles.heading} accessibilityRole="header">
          入力
        </Text>
        <View style={styles.placeholder}>
          <Text style={styles.note}>ひとこと記録・未来メモ・感情クエストはこれから置きます。</Text>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingTop: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.md },
  heading: { fontFamily: fonts.serif, fontSize: 22, lineHeight: 31, color: colors.brown },
  placeholder: {
    backgroundColor: colors.paper,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    padding: spacing.lg,
  },
  note: { fontFamily: fonts.sans, fontSize: 13, lineHeight: 22, color: colors.brownDim },
});
