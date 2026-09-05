import { StyleSheet, View } from 'react-native';
import { colors } from '@/theme';

/** A single brass hairline. Used instead of cards and boxes. */
export function HairlineRule({ inset = 0 }: { inset?: number }) {
  return <View style={[styles.rule, { marginHorizontal: inset }]} />;
}

const styles = StyleSheet.create({
  rule: {
    // Keeps its full width inside a centred column, where a view with no
    // width of its own would otherwise collapse to nothing.
    alignSelf: 'stretch',
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.frameSoft,
  },
});
