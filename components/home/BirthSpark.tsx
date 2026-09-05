import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Line } from 'react-native-svg';
import { colors } from '@/theme';

/**
 * One small star, once, when a record is saved (§22).
 *
 * The whole motion budget of the app is spent here. There is no particle
 * burst, no confetti and no sound: something was added to the sky, and the sky
 * says so quietly.
 */
export function BirthSpark({ trigger }: { trigger: number }) {
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.6);

  useEffect(() => {
    if (trigger === 0) return;
    opacity.value = withSequence(
      withTiming(1, { duration: 420, easing: Easing.out(Easing.quad) }),
      withDelay(520, withTiming(0, { duration: 900, easing: Easing.inOut(Easing.quad) }))
    );
    scale.value = withSequence(
      withTiming(1, { duration: 620, easing: Easing.out(Easing.cubic) }),
      withDelay(420, withTiming(1.12, { duration: 900 }))
    );
  }, [trigger, opacity, scale]);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  if (trigger === 0) return null;

  return (
    <View style={styles.wrap} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Animated.View style={style}>
        <Svg width={44} height={44} viewBox="-11 -11 22 22">
          <Line x1={-8} y1={0} x2={8} y2={0} stroke={colors.star} strokeWidth={0.5} />
          <Line x1={0} y1={-8} x2={0} y2={8} stroke={colors.star} strokeWidth={0.5} />
          <Circle r={2.1} fill={colors.star} />
          <Circle r={6.4} fill="none" stroke={colors.brassFaint} strokeWidth={0.5} />
        </Svg>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
});
