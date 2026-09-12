import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts, radii, spacing } from '@/theme';
import { COPY } from '@/constants/copy';
import type { PeriodType } from '@/types';

/**
 * 先月からの変化 / 去年との違い — the comparison, while a period is being named.
 *
 * Empty, for now, and deliberately so: the frame goes in before the reading
 * that fills it, because the frame is the part that has to be right. What this
 * says when it has nothing is 「比べられる記録は、まだ多くありません。」 — not
 * that the person recorded too little, and not a difference invented out of
 * two thin months.
 *
 * The reading that will sit here is the most dangerous one in the product: put
 * one record beside five and it is trivially easy to write 「増えた」, when all
 * that happened is that one of the two months was barely written in. So when
 * it arrives it arrives with the material on both sides visible — 先月 / 今月
 * side by side, as the preview shows them — and it is allowed to say nothing.
 */
export function PeriodChange({ periodType }: { periodType: PeriodType }) {
  return (
    <View style={styles.card} testID="period-change">
      <Text style={styles.empty}>
        {periodType === 'month' ? COPY.changeNone : COPY.vsPrevYearNone}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.paper,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    padding: spacing.lg,
  },
  empty: {
    fontFamily: fonts.sans,
    fontSize: 13,
    lineHeight: 22,
    color: colors.brownFaint,
    textAlign: 'center',
  },
});
