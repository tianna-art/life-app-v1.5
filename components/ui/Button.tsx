import { Pressable, StyleSheet, Text, type ViewStyle } from 'react-native';
import { HIT_SLOP, MIN_TOUCH, colors, fonts, radii, spacing } from '@/theme';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: 'outline' | 'solid' | 'quiet';
  disabled?: boolean;
  accessibilityHint?: string;
  style?: ViewStyle;
  testID?: string;
}

export function Button({
  label,
  onPress,
  variant = 'outline',
  disabled = false,
  accessibilityHint,
  style,
  testID,
}: ButtonProps) {
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
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
    borderRadius: radii.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // The one filled control: brown ground, cream type. Used for the single
  // action a screen is actually for, never for two things side by side.
  solid: { backgroundColor: colors.brown, borderColor: colors.brown },
  quiet: { borderColor: 'transparent' },
  pressed: { opacity: 0.62 },
  disabled: { borderColor: colors.hairline, opacity: 0.5 },
  label: {
    fontFamily: fonts.sans,
    fontSize: 14,
    letterSpacing: 0.4,
    color: colors.brown,
  },
  labelSolid: { color: colors.onBrown },
  labelDisabled: { color: colors.brownFaint },
});
