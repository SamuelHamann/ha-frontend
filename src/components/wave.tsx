/**
 * Water along the bottom of a card: a travelling wave while something is circulating — the
 * pool pump moving water — and a flat, still surface when it isn't.
 *
 * Built from a row of bars whose heights follow one sine wave, each offset a little further
 * along it, so the crest walks across the card. `still` flattens them and stops the loop, so
 * an idle card costs nothing while the water stays visible. It fills its parent, so the
 * parent needs `overflow: 'hidden'`, and it must be rendered before the content above it.
 */
import { useEffect } from 'react';
import { StyleSheet, View, type ColorValue } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

const BARS = 16;
/** One full pass of the crest across the card. */
const PERIOD_MS = 2800;
const MIN_HEIGHT = 6;
const MAX_HEIGHT = 22;
/** Still water: a calm band, no crest. */
const FLAT_HEIGHT = 7;

function WaveBar({
  index,
  phase,
  color,
  still,
}: {
  index: number;
  phase: SharedValue<number>;
  color: ColorValue;
  still: boolean;
}) {
  const style = useAnimatedStyle(() => {
    if (still) return { height: FLAT_HEIGHT };
    // One wavelength spread across the row, so the ends meet and the loop is seamless.
    const offset = (index / BARS) * Math.PI * 2;
    const wave = (Math.sin(phase.value + offset) + 1) / 2;
    return { height: MIN_HEIGHT + wave * (MAX_HEIGHT - MIN_HEIGHT) };
  });

  return <Animated.View style={[styles.bar, { backgroundColor: color }, style]} />;
}

export function Wave({ color, still = false }: { color: ColorValue; still?: boolean }) {
  const phase = useSharedValue(0);

  useEffect(() => {
    if (still) {
      // Leave no loop running behind a static surface.
      cancelAnimation(phase);
      phase.value = 0;
      return;
    }
    phase.value = withRepeat(
      withTiming(Math.PI * 2, { duration: PERIOD_MS, easing: Easing.linear }),
      -1,
      false,
    );
  }, [phase, still]);

  return (
    <View style={[styles.surface, still && styles.surfaceStill]} pointerEvents="none">
      {Array.from({ length: BARS }, (_, i) => (
        <WaveBar key={i} index={i} phase={phase} color={color} still={still} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  surface: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2,
    opacity: 0.22,
  },
  surfaceStill: {
    opacity: 0.12,
  },
  bar: {
    flex: 1,
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
  },
});
