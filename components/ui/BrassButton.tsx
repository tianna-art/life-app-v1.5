import { Pressable, StyleSheet, Text, type ViewStyle } from 'react-native';
import { HIT_SLOP, MIN_TOUCH, colors, fonts, radii, spacing } from '@/theme';

interface BrassButtonProps {
  label: string;
  onPress: () => void;
  variant?: 'outline' | 'solid' | 'quiet';
  disabled?: boolean;
  accessibilityHint?: string;
  style?: ViewStyle;
  testID?: string;
}

export function BrassButton({
  label,
  onPress,
  variant = 'outline',
  disabled = false,
  accessibilityHint,
  style,
  testID,
}: BrassButtonProps) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      hitSlop={HIT_SLOP}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      {...(accessibilityHint ? { accessibilityHint } : {})}
      style={({ pressed }) => [
        styles.base,
        variant === 'solid' && styles.solid,
        variant === 'quiet' && styles.quiet,
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
        style,
      ]}
    >
      <Text
        style={[
          styles.label,
          variant === 'solid' && styles.labelSolid,
          disabled && styles.labelDisabled,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: MIN_TOUCH,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderRadius: radii.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.brassDim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  solid: { backgroundColor: colors.brassFaint, borderColor: colors.brass },
  quiet: { borderColor: 'transparent' },
  pressed: { opacity: 0.62 },
  disabled: { borderColor: colors.frame, opacity: 0.5 },
  label: {
    fontFamily: fonts.sans,
    fontSize: 14,
    letterSpacing: 1.1,
    color: colors.ivory,
  },
  labelSolid: { color: colors.brass },
  labelDisabled: { color: colors.ivoryFaint },
});
