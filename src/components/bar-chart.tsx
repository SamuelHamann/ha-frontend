/**
 * A small bar chart for the modals and the Energy page. Deliberately plain: bars, a value
 * on top and a label per bar — enough to read a trend at a glance from across the room.
 * Hovering or tapping a bar captions it with its value; tapping pins a bubble of details
 * beside it. A bar may also be split into coloured slices, stacked from the bottom.
 *
 * Values and labels are laid out as their own rows above and below the plot rather than
 * inside each column, so every bar shares one baseline whether or not its own column is
 * captioned. (They used to sit in the column, and a blank caption collapsed to nothing on
 * the web — HTML drops lone whitespace — letting those bars hang a line lower than the
 * rest, down among the numbers.)
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { onPressAnywhere } from '@/components/press-away';
import { GlobalStyles, Palette, Radius, Spacing, Type } from '@/constants/styles';

const DENSE_LABEL_EVERY = 3;
const BUBBLE_WIDTH = 208;
/** Columns are laid out by flex; this must match `styles.plot.gap` for the bubble maths. */
const COLUMN_GAP = Spacing.one;
/** Fixed, so a row of captions or labels holds its height even when every cell is blank. */
const TEXT_ROW_HEIGHT = Type.label.lineHeight;

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

/** One cell of the caption or label row, lined up with the bar above or below it. */
function TextCell({ text, style }: { text: string; style: any }) {
  return (
    <View style={styles.cell}>
      <Text style={style} numberOfLines={1}>
        {text}
      </Text>
    </View>
  );
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
  /** Whether every bar carries its value, only the one under the pointer or pinned, or none. */
  captions?: 'all' | 'highlight' | 'none';
  /** Details for the pinned bar, shown in a bubble beside it. Tapping a bar pins it. */
  bubble?: (index: number) => Bubble;
}) {
  const [hovered, setHovered] = useState<string | null>(null);
  const [pinned, setPinned] = useState<string | null>(null);
  const [plotWidth, setPlotWidth] = useState(0);
  const plotRef = useRef<View>(null);
  // Set by a bar as a touch begins, so the app-wide press that follows is known to be ours.
  const touchingBarRef = useRef(false);

  // A press anywhere but on a bar unpins. On the web the document hears every pointer,
  // modals included, and the plot node says whether it was one of ours; natively the
  // hierarchy roots report every touch (see PressAwayRoot), and the bar marks its own.
  useEffect(() => {
    if (pinned === null) return;
    if (Platform.OS === 'web') {
      const onPointerDown = (e: Event) => {
        const plot = plotRef.current as unknown as { contains?: (n: unknown) => boolean } | null;
        if (!plot?.contains?.(e.target)) setPinned(null);
      };
      document.addEventListener('pointerdown', onPointerDown, true);
      return () => document.removeEventListener('pointerdown', onPointerDown, true);
    }
    return onPressAnywhere(() => {
      if (touchingBarRef.current) return;
      setPinned(null);
    });
  }, [pinned]);

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

  const isLit = (bar: Bar) => !bar.empty && (bar.key === hovered || bar.key === pinned);

  return (
    <Pressable style={styles.chart} onPress={() => setPinned(null)} accessible={false}>
      {captions !== 'none' && (
        <View style={styles.textRow}>
          {bars.map((bar, i) => {
            const lit = isLit(bar);
            const show = !bar.empty && (captions === 'all' || lit);
            return (
              <TextCell
                key={bar.key}
                text={show ? bar.value.toFixed(digits) : ''}
                style={[styles.value, lit && styles.valueLit]}
              />
            );
          })}
        </View>
      )}

      <View
        ref={plotRef}
        style={[styles.plot, { height }]}
        onLayout={(e) => setPlotWidth(e.nativeEvent.layout.width)}
      >
        {bars.map((bar, i) => {
          const ratio = (bar.value - floor) / span;
          const lit = isLit(bar);
          const sliceTotal = bar.slices?.reduce((sum, s) => sum + Math.max(s.value, 0), 0) || 1;
          return (
            <Pressable
              key={bar.key}
              style={styles.column}
              accessibilityLabel={`${bar.label}: ${bar.value.toFixed(digits)} ${unit}`}
              disabled={bar.empty}
              // Fires before the root hears the touch, since touches bubble outward.
              onTouchStart={() => {
                touchingBarRef.current = true;
              }}
              onTouchEnd={() => {
                touchingBarRef.current = false;
              }}
              onHoverIn={() => setHovered(bar.key)}
              onHoverOut={() => setHovered((h) => (h === bar.key ? null : h))}
              onPress={() => setPinned((p) => (p === bar.key ? null : bar.key))}
            >
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

      <View style={styles.textRow}>
        {bars.map((bar, i) => {
          const lit = isLit(bar);
          const show = !dense || i % DENSE_LABEL_EVERY === 0 || lit;
          return (
            <TextCell
              key={bar.key}
              text={show ? bar.label : ''}
              style={[styles.label, lit && styles.labelLit]}
            />
          );
        })}
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
    </Pressable>
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
    gap: 2,
  },
  plot: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: COLUMN_GAP,
  },
  /** Mirrors the plot's columns, so each cell sits under (or over) its own bar. */
  textRow: {
    flexDirection: 'row',
    gap: COLUMN_GAP,
    height: TEXT_ROW_HEIGHT,
  },
  cell: {
    flex: 1,
  },
  column: {
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
  value: {
    ...Type.label,
    color: Palette.text,
    textAlign: 'center',
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
