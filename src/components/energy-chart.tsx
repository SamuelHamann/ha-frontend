/**
 * Cost over one day (per hour) or one week (per day), with arrows to step through earlier
 * ones and a way home to today. The body of the device modals and, with `slices`, the
 * stacked house-total panel on the Energy page.
 *
 * Buckets arrive in kWh and are priced at the effective rate of the day they fell on (see
 * `useEnergyDays`), so an hour or a device is its share of that day's bill. Without any
 * cost statistics the chart falls back to kWh. Days and hours are the recorder's own — the
 * tablet's clock and zone never decide what "today" is — and labels are rendered in the
 * house's timezone.
 */
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { BarChart, type Bar, type Bubble, type BubbleRow } from '@/components/bar-chart';
import { ENERGY_CURRENCY, ENERGY_DAILY_DAYS } from '@/config/energy';
import { GlobalStyles, Palette, Spacing, Type } from '@/constants/styles';
import type { EnergySlice } from '@/hooks/use-energy-breakdown';
import type { EnergyPeriod, EnergyRange, EnergyView } from '@/hooks/use-energy-range';
import {
  priced as hasRates,
  rateFor,
  type EnergyBucket,
  type EnergyDay,
} from '@/hooks/use-energy-statistics';
import { useHomeAssistantContext } from '@/providers/home-assistant-provider';

const HOUR_MS = 3600 * 1000;
const HOURS_PER_DAY = 24;

export const PERIOD_SEGMENTS: { value: EnergyPeriod; label: string }[] = [
  { value: 'hour', label: 'Hourly' },
  { value: 'day', label: 'Daily' },
];

export function periodSubtitle(period: EnergyPeriod) {
  return period === 'day' ? `${ENERGY_DAILY_DAYS} days` : 'By hour';
}

export function formatMoney(amount: number) {
  return `${ENERGY_CURRENCY}${amount.toFixed(2)}`;
}

/** Formats in the house's timezone; an unsupported zone degrades to the device's. */
function inZone(date: Date, timeZone: string | null, options: Intl.DateTimeFormatOptions) {
  if (timeZone) {
    try {
      return date.toLocaleString([], { ...options, timeZone });
    } catch {
      // Fall through to the device zone.
    }
  }
  return date.toLocaleString([], options);
}

/** What the chart is looking at, as its heading: "TODAY", a date, or a span of dates. */
function rangeTitle(view: EnergyView, range: EnergyRange, timeZone: string | null) {
  if (view.period === 'hour') {
    if (view.offset === 0) return 'Today';
    return inZone(new Date(range.start), timeZone, { weekday: 'long', month: 'short', day: 'numeric' });
  }
  if (view.offset === 0) return `Last ${ENERGY_DAILY_DAYS} days`;
  const day = { month: 'short', day: 'numeric' } as const;
  return `${inZone(new Date(range.start), timeZone, day)} – ${inZone(new Date(range.end - 1), timeZone, day)}`;
}

function NavButton({
  icon,
  label,
  onPress,
  disabled,
}: {
  icon: SymbolViewProps['name'];
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      style={({ pressed }) => [GlobalStyles.chip, styles.navButton, pressed && GlobalStyles.pressed]}
    >
      <SymbolView name={icon} tintColor={disabled ? Palette.border : Palette.text} size={14} />
    </Pressable>
  );
}

type Slot = { start: Date; bucket?: EnergyBucket & { parts?: number[] } };
type Stacked = EnergyBucket & { parts?: number[] };

/** Everything a drawing of the chart is made from, kept together so a stale one is coherent. */
interface ChartData {
  view: EnergyView;
  range: EnergyRange;
  buckets: Stacked[] | null;
  days: EnergyDay[] | null;
}

export function EnergyChart({
  view,
  range,
  buckets,
  days,
  loading,
  error,
  slices,
  height = 170,
  onBack,
  onForward,
  onHome,
}: {
  view: EnergyView;
  range: EnergyRange;
  /** Null before anything has loaded. */
  buckets: Stacked[] | null;
  /** Null before anything has loaded. */
  days: EnergyDay[] | null;
  /** The range shown is still loading; `buckets` and `days` are then the previous ones. */
  loading: boolean;
  error: string | null;
  /** Names and colours of `parts`, when the buckets are split into a stack. */
  slices?: EnergySlice[];
  height?: number;
  onBack: () => void;
  onForward: () => void;
  onHome: () => void;
}) {
  const { timeZone } = useHomeAssistantContext();
  const { period } = view;
  const title = rangeTitle(view, range, timeZone);

  // While the next range loads, the bars of the last complete one stay up — dimmed —
  // rather than giving way to a spinner. Derived state, updated during render.
  const live: ChartData = { view, range, buckets, days };
  const complete = !loading && buckets !== null && days !== null;
  const [shown, setShown] = useState<ChartData>(live);
  if (complete && (shown.buckets !== buckets || shown.days !== days || shown.range !== range)) {
    setShown(live);
  }
  const data = complete ? live : shown;
  const stale = !complete;

  const nav = (
    <View style={styles.nav}>
      <NavButton
        icon={{ ios: 'chevron.left', android: 'chevron_left', web: 'chevron_left' }}
        label={period === 'day' ? 'Previous week' : 'Previous day'}
        onPress={onBack}
      />
      <NavButton
        icon={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }}
        label={period === 'day' ? 'Next week' : 'Next day'}
        onPress={onForward}
        disabled={view.offset === 0}
      />
      <Text style={Type.label}>{title.toUpperCase()}</Text>
      {view.offset !== 0 && (
        <Pressable
          onPress={onHome}
          accessibilityRole="button"
          accessibilityLabel={period === 'day' ? 'Back to this week' : 'Back to today'}
          hitSlop={6}
          style={({ pressed }) => [
            GlobalStyles.chip,
            GlobalStyles.chipActive,
            pressed && GlobalStyles.pressed,
          ]}
        >
          <Text style={[Type.label, styles.homeLabel]}>{period === 'day' ? 'THIS WEEK' : 'TODAY'}</Text>
        </Pressable>
      )}
    </View>
  );

  if (error) {
    return (
      <View style={styles.chart}>
        {nav}
        <Text style={[Type.mono, GlobalStyles.error]}>{error}</Text>
      </View>
    );
  }
  if (!data.buckets || !data.days) {
    return (
      <View style={styles.chart}>
        {nav}
        <ActivityIndicator size="small" color={Palette.textMuted} />
      </View>
    );
  }

  // Everything below draws `data`, which may be the previous range while `view` has moved on.
  const { buckets: drawn, days: drawnDays, range: drawnRange, view: drawnView } = data;
  const drawnPeriod = drawnView.period;
  const drawnTitle = rangeTitle(drawnView, drawnRange, timeZone);
  const priced = hasRates(drawnDays);
  // Hourly kWh carry two decimals: a plug idling at 9 W is 0.01 kWh an hour, and rounding
  // that to one place would print a row of zeros. Dollars always do.
  const digits = priced || drawnPeriod === 'hour' ? 2 : 1;
  const price = (kwh: number, at: Date) => (priced ? kwh * rateFor(drawnDays, at) : kwh);
  const format = priced ? formatMoney : (kwh: number) => `${kwh.toFixed(digits)} kWh`;

  const label = (at: Date) =>
    drawnPeriod === 'day'
      ? inZone(at, timeZone, { weekday: 'short' }).toUpperCase()
      : inZone(at, timeZone, { hour: '2-digit', hourCycle: 'h23' });
  const bubbleTitle = (at: Date) =>
    drawnPeriod === 'day'
      ? inZone(at, timeZone, { weekday: 'long', day: 'numeric', month: 'short' })
      : `${label(at)}:00`;

  // Hourly is a fixed day of 24 slots from the recorder's midnight, hours still to come
  // (or never recorded) left blank; daily is the week's buckets as they are.
  const slots: Slot[] =
    drawnPeriod === 'day'
      ? drawn.map((bucket) => ({ start: bucket.start, bucket }))
      : Array.from({ length: HOURS_PER_DAY }, (_, i) => {
          const start = new Date(drawnRange.start + i * HOUR_MS);
          return { start, bucket: drawn.find((b) => b.start.getTime() === start.getTime()) };
        });

  const bars: Bar[] = slots.map(({ start, bucket }) => ({
    key: start.toISOString(),
    label: label(start),
    value: bucket ? price(bucket.value, start) : 0,
    empty: !bucket,
    // The current period is still accumulating, so it is drawn hollow rather than compared
    // as an equal.
    muted: bucket?.partial,
    slices:
      slices && bucket?.parts
        ? bucket.parts.map((part, i) => ({ value: price(part, start), color: slices[i].color }))
        : undefined,
  }));

  const present = slots.flatMap((s) => (s.bucket ? [s.bucket] : []));
  const total = present.reduce((sum, b) => sum + price(b.value, b.start), 0);
  const finished = present.filter((b) => !b.partial);
  const average = finished.length
    ? finished.reduce((sum, b) => sum + price(b.value, b.start), 0) / finished.length
    : null;

  const bubble = (index: number): Bubble => {
    const { start, bucket } = slots[index];
    const rows: BubbleRow[] =
      slices && bucket?.parts
        ? slices.map((slice, i) => ({
            label: slice.name,
            value: format(price(bucket.parts![i], start)),
            color: slice.color,
          }))
        : [];
    const kwh = bucket?.value ?? 0;
    rows.push({ label: priced ? 'Total' : 'Energy', value: format(price(kwh, start)) });
    if (priced) rows.push({ label: 'Energy', value: `${kwh.toFixed(2)} kWh` });
    return { title: bubbleTitle(start), rows };
  };

  const stillCounting = present.some((b) => b.partial);

  return (
    <View style={styles.chart}>
      <View style={[GlobalStyles.spread, stale && styles.stale]}>
        <Text style={styles.total}>
          <Text style={Type.label}>{drawnTitle.toUpperCase()} </Text>
          {format(total)}
        </Text>
        <Text style={Type.label}>
          {drawnPeriod === 'day' ? 'DAILY' : 'HOURLY'} AVERAGE{' '}
          {average === null ? '—' : format(average)}
        </Text>
      </View>

      {nav}

      <View style={stale && styles.stale}>
        <BarChart
          bars={bars}
          unit={priced ? ENERGY_CURRENCY : 'kWh'}
          height={height}
          digits={digits}
          dense={drawnPeriod === 'hour'}
          captions="none"
          bubble={bubble}
        />
      </View>

      <Text style={[Type.label, styles.axis]}>
        {drawnPeriod === 'day' ? 'DAY' : 'HOUR OF DAY'}
        {stillCounting ? ' · CURRENT ONE STILL COUNTING' : ''}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chart: {
    gap: Spacing.two,
  },
  total: {
    ...Type.monoBright,
    fontSize: 16,
    lineHeight: 20,
    color: Palette.primary,
  },
  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  navButton: {
    paddingVertical: 2,
    paddingHorizontal: Spacing.one,
  },
  homeLabel: {
    color: Palette.primary,
  },
  axis: {
    textAlign: 'center',
  },
  /** The previous range, still up while the next one loads. */
  stale: {
    opacity: 0.4,
  },
});
