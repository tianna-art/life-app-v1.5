import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, spacing } from '@/theme';
import { Screen } from '@components/ui/Screen';

/**
 * 足跡データ — 月次 / 年次.
 *
 * Phase 2 builds the month strip and the hand-entered titles for periods
 * that predate the app.
 */
export default function ListScreen() {
  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <Text style={styles.heading} accessibilityRole="header">
          足跡データ
        </Text>
        <View style={styles.placeholder}>
          <Text style={styles.note}>月次・年次の一覧はこれから置きます。</Text>
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
