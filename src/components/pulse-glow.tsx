/**
 * A slow pulsing wash of colour behind a card, marking something as actively running.
 *
 * Mount it only while the thing is running — unmounting stops the loop, so an idle card
 * costs nothing. It fills its parent, so the parent needs `overflow: 'hidden'` to keep the
 * wash inside its corners, and it must be rendered before the content it sits behind.
 */
import { useEffect } from 'react';
import { StyleSheet, type ColorValue } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

const PULSE_MS = 1600;
const MIN_OPACITY = 0.09;
const MAX_OPACITY = 0.34;

export function PulseGlow({ color }: { color: ColorValue }) {
  const pulse = useSharedValue(0);

  useEffect(() => {
    pulse.value = withRepeat(
      withTiming(1, { duration: PULSE_MS, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
  }, [pulse]);

  const style = useAnimatedStyle(() => ({
    opacity: MIN_OPACITY + pulse.value * (MAX_OPACITY - MIN_OPACITY),
  }));

  return (
    <Animated.View pointerEvents="none" style={[styles.glow, { backgroundColor: color }, style]} />
  );
}

const styles = StyleSheet.create({
  glow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
});
