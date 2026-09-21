/**
 * Cost today (per hour) or over the last week (per day). The body of the device modals
 * and, with `slices`, the stacked house-total panel on the Energy page.
 *
 * Buckets arrive in kWh and are priced at the effective rate of the day they fell on (see
 * `useEnergyDays`), so an hour or a device is its share of that day's bill. Without any
 * cost statistics the chart falls back to kWh. Days and hours are the recorder's own — the
 * tablet's clock and zone never decide what "today" is — and labels are rendered in the
 * house's timezone. Both scales are already in hand, so `period` only picks which to draw.
 */
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { BarChart, type Bar, type Bubble, type BubbleRow } from '@/components/bar-chart';
import { ENERGY_CURRENCY, ENERGY_DAILY_DAYS } from '@/config/energy';
import { GlobalStyles, Palette, Spacing, Type } from '@/constants/styles';
import type { EnergySlice } from '@/hooks/use-energy-breakdown';
import {
  priced as hasRates,
  rateFor,
  todayStart,
  type EnergyBucket,
  type EnergyDay,
  type EnergyPeriod,
} from '@/hooks/use-energy-statistics';
import { useHomeAssistantContext } from '@/providers/home-assistant-provider';

const HOUR_MS = 3600 * 1000;
const HOURS_PER_DAY = 24;

export const PERIOD_SEGMENTS: { value: EnergyPeriod; label: string }[] = [
  { value: 'hour', label: 'Hourly' },
  { value: 'day', label: 'Daily' },
];

export function periodSubtitle(period: EnergyPeriod) {
  return period === 'day' ? `Last ${ENERGY_DAILY_DAYS} days` : 'Today by hour';
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

type Slot = { start: Date; bucket?: EnergyBucket & { parts?: number[] } };

export function EnergyChart({
  buckets,
  days,
  error,
  period,
  slices,
  height = 170,
}: {
  /** Null while loading. */
  buckets: (EnergyBucket & { parts?: number[] })[] | null;
  /** Null while loading. */
  days: EnergyDay[] | null;
  error: string | null;
  period: EnergyPeriod;
  /** Names and colours of `parts`, when the buckets are split into a stack. */
  slices?: EnergySlice[];
  height?: number;
}) {
  const { timeZone, serverNow } = useHomeAssistantContext();

  if (error) return <Text style={[Type.mono, GlobalStyles.error]}>{error}</Text>;
  if (!buckets || !days) return <ActivityIndicator size="small" color={Palette.textMuted} />;

  const priced = hasRates(days);
  // Hourly kWh carry two decimals: a plug idling at 9 W is 0.01 kWh an hour, and rounding
  // that to one place would print a row of zeros. Dollars always do.
  const digits = priced || period === 'hour' ? 2 : 1;
  const price = (kwh: number, at: Date) => (priced ? kwh * rateFor(days, at) : kwh);
  const format = priced ? formatMoney : (kwh: number) => `${kwh.toFixed(digits)} kWh`;

  const label = (at: Date) =>
    period === 'day'
      ? inZone(at, timeZone, { weekday: 'short' }).toUpperCase()
      : inZone(at, timeZone, { hour: '2-digit', hourCycle: 'h23' });
  const title = (at: Date) =>
    period === 'day'
      ? inZone(at, timeZone, { weekday: 'long', day: 'numeric', month: 'short' })
      : `${label(at)}:00`;

  // Hourly is a fixed day of 24 slots from the recorder's midnight, the hours still to come
  // left blank; daily is the week's buckets as they are.
  const dayStart = todayStart(days, serverNow().getTime());
  const slots: Slot[] =
    period === 'day'
      ? buckets.map((bucket) => ({ start: bucket.start, bucket }))
      : Array.from({ length: HOURS_PER_DAY }, (_, i) => {
          const start = new Date(dayStart + i * HOUR_MS);
          return { start, bucket: buckets.find((b) => b.start.getTime() === start.getTime()) };
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

  const shown = slots.flatMap((s) => (s.bucket ? [s.bucket] : []));
  const total = shown.reduce((sum, b) => sum + price(b.value, b.start), 0);
  const complete = shown.filter((b) => !b.partial);
  const average = complete.length
    ? complete.reduce((sum, b) => sum + price(b.value, b.start), 0) / complete.length
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
    return { title: title(start), rows };
  };

  return (
    <View style={styles.chart}>
      <View style={GlobalStyles.spread}>
        <Text style={styles.total}>
          <Text style={Type.label}>{period === 'day' ? 'THIS WEEK ' : 'TODAY '}</Text>
          {format(total)}
        </Text>
        <Text style={Type.label}>
          {period === 'day' ? 'DAILY' : 'HOURLY'} AVERAGE {average === null ? '—' : format(average)}
        </Text>
      </View>

      <BarChart
        bars={bars}
        unit={priced ? ENERGY_CURRENCY : 'kWh'}
        height={height}
        digits={digits}
        dense={period === 'hour'}
        captions="highlight"
        bubble={bubble}
      />

      <Text style={[Type.label, styles.axis]}>
        {period === 'day' ? 'DAY' : 'HOUR OF DAY'} · CURRENT ONE STILL COUNTING
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
  axis: {
    textAlign: 'center',
  },
});
