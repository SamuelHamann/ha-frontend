import { useMemo } from 'react';

import { ENERGY_CATEGORIES, ENERGY_REMAINDER_NAME, ENERGY_TOTAL_STATISTIC_ID } from '@/config/energy';
import { Series } from '@/constants/styles';
import {
  useEnergyStatistics,
  type EnergyBucket,
  type EnergyPeriod,
  type EnergySeries,
  type EnergySource,
} from '@/hooks/use-energy-statistics';
import { useMeteredDevices } from '@/hooks/use-metered-devices';

export interface EnergySlice {
  name: string;
  color: string;
}

/** A house-total bucket with its share per category, in `slices` order. */
export interface StackedBucket extends EnergyBucket {
  parts: number[];
}

const HOUSE_TOTAL: EnergySource = { kind: 'energy', statisticId: ENERGY_TOTAL_STATISTIC_ID };
const ALL_CATEGORY_DEVICES = ENERGY_CATEGORIES.flatMap((c) => c.devices);

/** The named categories plus the remainder, each with its stack colour. */
export const ENERGY_SLICES: EnergySlice[] = [
  ...ENERGY_CATEGORIES.map((c, i) => ({ name: c.name, color: Series.stack[i % Series.stack.length] })),
  { name: ENERGY_REMAINDER_NAME, color: Series.rest },
];

function stack(series: EnergySeries, categories: string[][]): StackedBucket[] {
  // Devices without a reading in a bucket simply have no row for it, so each category is
  // summed by bucket start rather than by row index.
  const byStart = (id: string) => new Map(series[id]?.map((b) => [b.start.getTime(), b.value]) ?? []);
  const lookups = categories.map((ids) => ids.map(byStart));

  return (series[ENERGY_TOTAL_STATISTIC_ID] ?? []).map((bucket) => {
    const at = bucket.start.getTime();
    const parts = lookups.map((maps) => maps.reduce((sum, m) => sum + (m.get(at) ?? 0), 0));
    const named = parts.reduce((sum, v) => sum + v, 0);
    // The meter and the per-device counters don't tick in lockstep, so the remainder can
    // dip below zero for a moment; it is clamped rather than drawn upside down.
    parts.push(Math.max(bucket.value - named, 0));
    return { ...bucket, parts };
  });
}

/**
 * The house total per hour and per day, split into the configured categories plus a
 * remainder — one stacked bar per bucket.
 */
export function useEnergyBreakdown() {
  const devices = useMeteredDevices(ALL_CATEGORY_DEVICES);

  // `devices` refreshes with every live reading; that is fine here, since the fetch keys on
  // the statistic ids and those only change when the registry does.
  const sources = useMemo<EnergySource[]>(
    () => [HOUSE_TOTAL, ...devices.flatMap((d) => (d.source ? [d.source] : []))],
    [devices],
  );
  const categories = useMemo(
    () =>
      ENERGY_CATEGORIES.map((c) =>
        c.devices.flatMap((d) => {
          const source = devices.find((m) => m.deviceId === d.deviceId)?.source;
          return source ? [source.statisticId] : [];
        }),
      ),
    [devices],
  );

  const { byPeriod, error } = useEnergyStatistics(sources);

  const buckets = useMemo<Record<EnergyPeriod, StackedBucket[]> | null>(
    () =>
      byPeriod
        ? { hour: stack(byPeriod.hour, categories), day: stack(byPeriod.day, categories) }
        : null,
    [byPeriod, categories],
  );

  return { buckets, slices: ENERGY_SLICES, error };
}
