/**
 * A small bar chart for the modals. Deliberately plain: bars, a value on the tallest, and a
 * label per bar — enough to read a trend at a glance from across the room.
 */
import { StyleSheet, Text, View } from 'react-native';

import { GlobalStyles, Palette, Radius, Spacing, Type } from '@/constants/styles';

export interface Bar {
  key: string;
  label: string;
  value: number;
  /** Drawn hollow — an incomplete period, say. */
  muted?: boolean;
}

export function BarChart({
  bars,
  unit,
  height = 140,
  digits = 1,
  baseline = 'zero',
}: {
  bars: Bar[];
  unit: string;
  height?: number;
  digits?: number;
  /**
   * 'zero' keeps the axis honest for magnitudes like kWh. 'auto' drops the floor just below
   * the smallest bar, so a series that only moves within a narrow band — soil humidity
   * sitting around 47% all day — still shows its shape instead of eight identical bars.
   */
  baseline?: 'zero' | 'auto';
}) {
  if (bars.length === 0) {
    return <Text style={Type.bodyMuted}>No data for this period</Text>;
  }

  const values = bars.map((b) => b.value);
  const max = Math.max(...values);
  const lowest = Math.min(...values);
  // A zoomed baseline exaggerates small differences, so the axis floor is printed below the
  // chart whenever it isn't zero.
  const floor =
    baseline === 'zero'
      ? Math.min(lowest, 0)
      : lowest - Math.max((max - lowest) * 0.45, Math.abs(lowest) * 0.002, 0.05);
  const span = max - floor || 1;

  return (
    <View style={styles.chart}>
      <View style={[styles.plot, { height }]}>
        {bars.map((bar) => {
          const ratio = (bar.value - floor) / span;
          return (
            <View key={bar.key} style={styles.column}>
              <Text style={styles.value} numberOfLines={1}>
                {bar.value.toFixed(digits)}
              </Text>
              <View style={styles.barTrack}>
                <View
                  style={[
                    styles.bar,
                    bar.muted ? styles.barMuted : styles.barSolid,
                    // A floor of a few px so an empty period is still a visible tick.
                    { height: `${Math.max(ratio * 100, 2)}%` },
                  ]}
                />
              </View>
              <Text style={styles.label} numberOfLines={1}>
                {bar.label}
              </Text>
            </View>
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
    gap: Spacing.one,
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
  bar: {
    borderTopLeftRadius: Radius.sm,
    borderTopRightRadius: Radius.sm,
  },
  barSolid: {
    backgroundColor: Palette.primary,
  },
  barMuted: {
    backgroundColor: Palette.panelActive,
    borderWidth: 1,
    borderColor: Palette.primary,
  },
  value: {
    ...Type.label,
    color: Palette.text,
    textAlign: 'center',
  },
  label: {
    ...Type.label,
    textAlign: 'center',
  },
});
