import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts, radii, spacing } from '@/theme';

/**
 * 1 方向を定める / 2 今を見つめる / 3 足跡がつく.
 *
 * The number sits in its own circle to the left and the text does not indent
 * past the screen's margin: the numeral marks the band, it does not push the
 * band inward.
 */
export function SectionHeading({
  number,
  title,
  sub,
}: {
  number: number;
  title: string;
  sub?: string;
}) {
  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{number}</Text>
        </View>
        <Text style={styles.title} accessibilityRole="header">
          {title}
        </Text>
      </View>
      {sub ? <Text style={styles.sub}>{sub}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  badge: {
    width: 22,
    height: 22,
    borderRadius: radii.pill,
    backgroundColor: colors.orange,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { fontFamily: fonts.sans, fontSize: 12, color: colors.cream },
  title: { fontFamily: fonts.serif, fontSize: 17, color: colors.brown },
  sub: { fontFamily: fonts.sans, fontSize: 12, lineHeight: 20, color: colors.brownFaint },
});
