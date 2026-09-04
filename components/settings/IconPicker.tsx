import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { HIT_SLOP, MIN_TOUCH, colors, fonts, radii, spacing } from '@/theme';
import { CATEGORY_ICONS, type CategoryIcon } from '@/constants/icons';
import { CategoryMark } from '@components/ui/CategoryMark';
import { PhoneOverlay } from '@components/ui/PhoneFrame';

/**
 * The marks a drawer can wear. A closed set drawn from the same atlas as the
 * MAP — picking one is choosing a face, not filling in a field, so there is no
 * confirm step: tap a mark and the sheet closes.
 */
export function IconPicker({
  visible,
  categoryName,
  value,
  onPick,
  onClose,
}: {
  visible: boolean;
  categoryName: string;
  value: CategoryIcon;
  onPick: (icon: CategoryIcon) => void;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <PhoneOverlay>
        <Pressable style={styles.scrim} onPress={onClose} accessibilityLabel="閉じる" />
        <View style={styles.sheet} testID="icon-picker">
          <Text style={styles.heading} accessibilityRole="header">
            {categoryName} のしるし
          </Text>
          <View style={styles.grid}>
            {CATEGORY_ICONS.map((icon) => {
              const selected = icon === value;
              return (
                <Pressable
                  key={icon}
                  testID={`icon-option-${icon}`}
                  onPress={() => {
                    onPick(icon);
                    onClose();
                  }}
                  hitSlop={HIT_SLOP}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  accessibilityLabel={`しるしを ${icon} にする`}
                  style={({ pressed }) => [
                    styles.cell,
                    selected && styles.cellSelected,
                    pressed && styles.pressed,
                  ]}
                >
                  <CategoryMark icon={icon} size={30} active={selected} />
                </Pressable>
              );
            })}
          </View>
        </View>
      </PhoneOverlay>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.scrim,
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.frameSoft,
    paddingHorizontal: spacing.gallery,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.lg,
  },
  heading: { fontFamily: fonts.serif, fontSize: 16, color: colors.ivory },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  cell: {
    width: MIN_TOUCH + 8,
    height: MIN_TOUCH + 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.frame,
  },
  cellSelected: { borderColor: colors.brass, backgroundColor: colors.brassFaint },
  pressed: { opacity: 0.6 },
});
