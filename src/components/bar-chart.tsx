/**
 * A small bar chart for the modals and the Energy page. Deliberately plain: bars and a
 * label per bar — enough to read a trend at a glance from across the room. Hovering a bar
 * captions it with its value; tapping it pins a bubble of details beside it. A bar may also
 * be split into coloured slices, stacked from the bottom.
 */
import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { GlobalStyles, Palette, Radius, Spacing, Type } from '@/constants/styles';

const DENSE_LABEL_EVERY = 3;
const BUBBLE_WIDTH = 208;
/** Columns are laid out by flex; this must match `styles.plot.gap` for the bubble maths. */
const COLUMN_GAP = Spacing.one;

export interface BarSlice {
  value: number;
  color: string;
}

export interface Bar {
  key: string;
  label: string;
  value: number;
  /** Drawn hollow (or, when sliced, faded) — an incomplete period, say. */
  muted?: boolean;
  /** Splits the bar into stacked slices, bottom first. They should sum to `value`. */
  slices?: BarSlice[];
  /** A slot with nothing to show yet — an hour still to come. Labelled, but no bar. */
  empty?: boolean;
}

export interface BubbleRow {
  label: string;
  value: string;
  /** Swatch colour, for a row that names a slice. */
  color?: string;
}

export interface Bubble {
  title: string;
  rows: BubbleRow[];
}

export function BarChart({
  bars,
  unit,
  height = 140,
  digits = 1,
  baseline = 'zero',
  dense = false,
  captions = 'all',
  bubble,
}: {
  bars: Bar[];
  unit: string;
  height?: number;
  digits?: number;
  /** For long series — 24 hours, say: labels are thinned to every DENSE_LABEL_EVERY-th bar. */
  dense?: boolean;
  /**
   * 'zero' keeps the axis honest for magnitudes like kWh. 'auto' drops the floor just below
   * the smallest bar, so a series that only moves within a narrow band — soil humidity
   * sitting around 47% all day — still shows its shape instead of eight identical bars.
   */
  baseline?: 'zero' | 'auto';
  /** Whether every bar carries its value, or only the one under the pointer or pinned. */
  captions?: 'all' | 'highlight';
  /** Details for the pinned bar, shown in a bubble beside it. Tapping a bar pins it. */
  bubble?: (index: number) => Bubble;
}) {
  const [hovered, setHovered] = useState<string | null>(null);
  // Keyed rather than indexed: a switch from 24 hourly bars to 7 daily ones must not leave
  // a pin pointing past the end of the new series.
  const [pinned, setPinned] = useState<string | null>(null);
  const [plotWidth, setPlotWidth] = useState(0);

  if (bars.length === 0) {
    return <Text style={Type.bodyMuted}>No data for this period</Text>;
  }

  const values = bars.filter((b) => !b.empty).map((b) => b.value);
  const max = values.length ? Math.max(...values) : 0;
  const lowest = values.length ? Math.min(...values) : 0;
  // A zoomed baseline exaggerates small differences, so the axis floor is printed below the
  // chart whenever it isn't zero.
  const floor =
    baseline === 'zero'
      ? Math.min(lowest, 0)
      : lowest - Math.max((max - lowest) * 0.45, Math.abs(lowest) * 0.002, 0.05);
  const span = max - floor || 1;

  // The bubble hangs off the pinned bar's left side, flipping to the right when it would
  // run past the plot's edge, and never leaves the plot either way.
  const columnWidth = (plotWidth - COLUMN_GAP * (bars.length - 1)) / bars.length;
  const bubbleLeft = (index: number) => {
    const barLeft = index * (columnWidth + COLUMN_GAP);
    const onLeft = barLeft - COLUMN_GAP - BUBBLE_WIDTH;
    if (onLeft >= 0) return onLeft;
    return Math.min(barLeft + columnWidth + COLUMN_GAP, Math.max(plotWidth - BUBBLE_WIDTH, 0));
  };
  const pinnedIndex = pinned === null ? -1 : bars.findIndex((b) => b.key === pinned);
  const pinnedBubble = pinnedIndex >= 0 && bubble && plotWidth > 0 ? bubble(pinnedIndex) : null;

  return (
    <View style={styles.chart}>
      <View
        style={[styles.plot, { height }]}
        onLayout={(e) => setPlotWidth(e.nativeEvent.layout.width)}
      >
        {bars.map((bar, i) => {
          const ratio = (bar.value - floor) / span;
          const lit = !bar.empty && (bar.key === hovered || bar.key === pinned);
          const showValue = !bar.empty && (captions === 'all' || lit);
          const showLabel = !dense || i % DENSE_LABEL_EVERY === 0 || lit;
          const sliceTotal = bar.slices?.reduce((sum, s) => sum + Math.max(s.value, 0), 0) || 1;
          return (
            <Pressable
              key={bar.key}
              style={styles.column}
              accessibilityLabel={`${bar.label}: ${bar.value.toFixed(digits)} ${unit}`}
              // Hover for a pointer, tap for a finger; tapping the pinned bar unpins it.
              disabled={bar.empty}
              onHoverIn={() => setHovered(bar.key)}
              onHoverOut={() => setHovered((h) => (h === bar.key ? null : h))}
              onPress={() => setPinned((p) => (p === bar.key ? null : bar.key))}
            >
              <Text style={[styles.value, lit && styles.valueLit]} numberOfLines={1}>
                {showValue ? bar.value.toFixed(digits) : ' '}
              </Text>
              <View style={styles.barTrack}>
                {!bar.empty && (
                <View
                  style={[
                    styles.bar,
                    bar.slices
                      ? [styles.barSliced, bar.muted && styles.barSlicedMuted]
                      : bar.muted
                        ? styles.barMuted
                        : styles.barSolid,
                    lit && styles.barLit,
                    // A floor of a few px so an empty period is still a visible tick.
                    { height: `${Math.max(ratio * 100, 2)}%` },
                  ]}
                >
                  {/* Sized as a share of the bar rather than by flex: flex weights that sum
                      below one leave the remainder unfilled, which read as a black bar. */}
                  {bar.slices?.map((slice, j) => (
                    <View
                      key={j}
                      style={{
                        height: `${(Math.max(slice.value, 0) / sliceTotal) * 100}%`,
                        backgroundColor: slice.color,
                      }}
                    />
                  ))}
                </View>
                )}
              </View>
              <Text style={[styles.label, lit && styles.labelLit]} numberOfLines={1}>
                {showLabel ? bar.label : ' '}
              </Text>
            </Pressable>
          );
        })}

        {pinnedBubble && (
          <View style={[styles.bubble, { left: bubbleLeft(pinnedIndex) }]} pointerEvents="none">
            <Text style={[Type.label, styles.bubbleTitle]}>{pinnedBubble.title.toUpperCase()}</Text>
            {pinnedBubble.rows.map((row) => (
              <BubbleLine key={row.label} row={row} />
            ))}
          </View>
        )}
      </View>

      <View style={GlobalStyles.divider}>
        <Text style={Type.label}>
          {baseline === 'zero' ? 'MIN' : 'AXIS FROM'} {floor.toFixed(digits)}
        </Text>
        <View style={GlobalStyles.dividerRule} />
        <Text style={Type.label}>
          MAX {max.toFixed(digits)} {unit.toUpperCase()}
        </Text>
      </View>
    </View>
  );
}

function BubbleLine({ row }: { row: BubbleRow }): ReactNode {
  return (
    <View style={styles.bubbleRow}>
      {!!row.color && <View style={[GlobalStyles.led, { backgroundColor: row.color }]} />}
      <Text style={[Type.label, styles.bubbleLabel]} numberOfLines={1}>
        {row.label.toUpperCase()}
      </Text>
      <Text style={Type.monoBright}>{row.value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chart: {
    gap: Spacing.two,
  },
  plot: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: COLUMN_GAP,
  },
  column: {
    flex: 1,
    justifyContent: 'flex-end',
    gap: 2,
  },
  barTrack: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  /** Always bordered, so lighting a bar recolours it without reflowing its slices. */
  bar: {
    borderTopLeftRadius: Radius.sm,
    borderTopRightRadius: Radius.sm,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  barSolid: {
    backgroundColor: Palette.primary,
  },
  barMuted: {
    backgroundColor: Palette.panelActive,
    borderColor: Palette.primary,
  },
  /** Slices fill bottom-up, so the first named series sits on the axis. */
  barSliced: {
    flexDirection: 'column-reverse',
    overflow: 'hidden',
    backgroundColor: Palette.panelActive,
  },
  barSlicedMuted: {
    opacity: 0.45,
  },
  barLit: {
    borderColor: Palette.text,
  },
  /** Allowed to spill past its column: hourly columns are narrower than a price. */
  value: {
    ...Type.label,
    color: Palette.text,
    textAlign: 'center',
    marginHorizontal: -Spacing.four,
  },
  valueLit: {
    color: Palette.secondary,
  },
  label: {
    ...Type.label,
    textAlign: 'center',
  },
  labelLit: {
    color: Palette.text,
  },
  bubble: {
    position: 'absolute',
    top: 0,
    width: BUBBLE_WIDTH,
    backgroundColor: Palette.panel,
    borderWidth: 1,
    borderColor: Palette.border,
    borderRadius: Radius.sm,
    padding: Spacing.two,
    gap: Spacing.one,
    shadowColor: '#000000',
    shadowOpacity: 0.5,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
    zIndex: 1,
  },
  bubbleTitle: {
    color: Palette.text,
  },
  bubbleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  bubbleLabel: {
    flex: 1,
  },
});
