import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, spacing } from '@/theme';
import { Screen } from '@components/ui/Screen';

/**
 * マイページ — 通知 / 記録の書き出し / アカウント.
 *
 * ビジョンボード does not live here: it opens and closes on the map.
 */
export default function SettingsScreen() {
  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <Text style={styles.heading} accessibilityRole="header">
          マイページ
        </Text>
        <View style={styles.placeholder}>
          <Text style={styles.note}>通知・記録の書き出し・アカウントはこれから置きます。</Text>
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
