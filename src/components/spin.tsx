/**
 * Rotates its child forever — a running fan, a working indicator.
 *
 * Mount it only while the motion should run; unmounting stops the loop. The rotation is
 * linear and wraps at a full turn, so the loop point is invisible.
 */
import { useEffect, type ReactNode } from 'react';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

/** One turn. Slow enough to read as motion rather than agitation on a wall panel. */
const TURN_MS = 2400;

export function Spin({ children, durationMs = TURN_MS }: { children: ReactNode; durationMs?: number }) {
  const angle = useSharedValue(0);

  useEffect(() => {
    angle.value = 0;
    angle.value = withRepeat(
      withTiming(360, { duration: durationMs, easing: Easing.linear }),
      -1,
      false,
    );
  }, [angle, durationMs]);

  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${angle.value}deg` }] }));

  return <Animated.View style={style}>{children}</Animated.View>;
}
