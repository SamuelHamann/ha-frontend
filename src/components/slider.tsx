/**
 * A plain drag-or-tap track. Built here rather than pulled in, since the app needs exactly
 * one shape of slider and no dependency offers it without a native module.
 *
 * The value is reported once the gesture ends, not on every frame — each change is a service
 * call to Home Assistant, and streaming them while dragging would flood the socket.
 */
import { useMemo, useState } from 'react';
import { StyleSheet, View, type ColorValue } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

import { Palette, Radius } from '@/constants/styles';

export function Slider({
  value,
  min,
  max,
  color = Palette.primary,
  segments,
  disabled,
  onCommit,
}: {
  value: number;
  min: number;
  max: number;
  color?: ColorValue;
  /**
   * Paints the track as this run of colours instead of a filled bar — a hue or saturation
   * ramp, where the track itself has to show what you are choosing between.
   */
  segments?: string[];
  disabled?: boolean;
  onCommit: (value: number) => void;
}) {
  const [width, setWidth] = useState(0);
  const [dragging, setDragging] = useState<number | null>(null);

  const clamp = (raw: number) => Math.min(Math.max(raw, min), max);
  const fromX = (x: number) => clamp(min + (x / (width || 1)) * (max - min));

  const gesture = useMemo(
    () =>
      Gesture.Pan()
        // The whole interaction lives in React state, so it runs on the JS thread.
        .runOnJS(true)
        .enabled(!disabled && width > 0)
        // Claim the touch immediately: a tap anywhere on the track should set the value,
        // and a slider that needs a minimum drag first feels broken.
        .minDistance(0)
        // Dragging past the end of the track keeps tracking instead of snapping back.
        .shouldCancelWhenOutside(false)
        .onBegin((e) => setDragging(fromX(e.x)))
        .onUpdate((e) => setDragging(fromX(e.x)))
        // Committing here rather than in onEnd: a Pan only reaches onEnd once it has
        // *activated*, which a tap with no movement never does — so tapping a spot on the
        // track did nothing. onFinalize runs for a tap and a drag alike, and carries the
        // final position, so no extra bookkeeping is needed to know where the finger was.
        .onFinalize((e) => {
          setDragging(null);
          onCommit(Math.round(fromX(e.x)));
        }),
    // fromX closes over width, min and max.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [disabled, width, min, max, onCommit],
  );

  const shown = dragging ?? clamp(value);
  const ratio = (shown - min) / (max - min || 1);

  return (
    <GestureDetector gesture={gesture}>
      <View
        style={styles.hitArea}
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
        accessibilityRole="adjustable"
        accessibilityValue={{ min, max, now: Math.round(shown) }}
      >
        <View style={[styles.track, disabled && styles.trackDisabled]}>
          {segments ? (
            <View style={styles.ramp}>
              {segments.map((segment, i) => (
                <View key={i} style={[styles.rampStep, { backgroundColor: segment }]} />
              ))}
            </View>
          ) : (
            <View style={[styles.fill, { width: `${ratio * 100}%`, backgroundColor: color }]} />
          )}
        </View>
        {/* A knob, so the track reads as draggable rather than as a progress bar. */}
        <View
          pointerEvents="none"
          style={[
            styles.knob,
            { left: `${ratio * 100}%`, borderColor: color },
            disabled && styles.trackDisabled,
          ]}
        />
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  /** Generous vertical padding: the track is thin, the target should not be. */
  hitArea: {
    paddingVertical: 10,
    justifyContent: 'center',
  },
  track: {
    height: 10,
    borderRadius: Radius.sm,
    backgroundColor: Palette.panelDeep,
    borderWidth: 1,
    borderColor: Palette.border,
    overflow: 'hidden',
  },
  trackDisabled: {
    opacity: 0.4,
  },
  fill: {
    height: '100%',
  },
  ramp: {
    flexDirection: 'row',
    height: '100%',
  },
  rampStep: {
    flex: 1,
  },
  knob: {
    position: 'absolute',
    width: 18,
    height: 18,
    // Centres the knob on the fill edge.
    marginLeft: -9,
    borderRadius: 9,
    borderWidth: 2,
    backgroundColor: Palette.panel,
  },
});
