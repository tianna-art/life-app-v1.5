import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line } from 'react-native-svg';
import { HIT_SLOP, MIN_TOUCH, colors, fonts, radii, spacing } from '@/theme';
import { PhoneOverlay } from '@components/ui/PhoneFrame';

export interface MenuItem {
  label: string;
  onPress: () => void;
}

/**
 * The menu icon that replaced the big central ＋.
 *
 * Writing no longer lives behind a button, so the one control left at the top
 * is this: the few things you occasionally need, out of the way of the page.
 */
export function LogMenuButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      testID="open-menu"
      onPress={onPress}
      hitSlop={HIT_SLOP}
      accessibilityRole="button"
      accessibilityLabel="メニュー"
      style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
    >
      <Svg width={22} height={22} viewBox="-11 -11 22 22">
        <Line x1={-8} y1={-5} x2={8} y2={-5} stroke={colors.ivoryDim} strokeWidth={1} />
        <Line x1={-8} y1={0} x2={8} y2={0} stroke={colors.ivoryDim} strokeWidth={1} />
        <Line x1={-8} y1={5} x2={3} y2={5} stroke={colors.ivoryDim} strokeWidth={1} />
        <Circle cx={7} cy={5} r={1.5} fill={colors.brass} />
      </Svg>
    </Pressable>
  );
}

export function LogMenu({
  visible,
  items,
  onClose,
}: {
  visible: boolean;
  items: MenuItem[];
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <PhoneOverlay>
        <Pressable style={styles.scrim} onPress={onClose} accessibilityLabel="閉じる" />
        <View style={styles.sheet} testID="log-menu">
          {items.map((item) => (
            <Pressable
              key={item.label}
              testID={`menu-${item.label}`}
              onPress={() => {
                onClose();
                item.onPress();
              }}
              accessibilityRole="button"
              accessibilityLabel={item.label}
              style={({ pressed }) => [styles.item, pressed && styles.pressed]}
            >
              <Text style={styles.itemLabel}>{item.label}</Text>
            </Pressable>
          ))}
        </View>
      </PhoneOverlay>
    </Modal>
  );
}

const styles = StyleSheet.create({
  iconButton: {
    minWidth: MIN_TOUCH,
    minHeight: MIN_TOUCH,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.55 },
  scrim: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.scrim },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: colors.brassFaint,
    paddingVertical: spacing.sm,
    paddingBottom: spacing.xl,
  },
  item: {
    minHeight: MIN_TOUCH + 6,
    justifyContent: 'center',
    paddingHorizontal: spacing.gallery,
  },
  itemLabel: { fontFamily: fonts.sans, fontSize: 16, color: colors.ivory },
});
