import { useEffect, useMemo, useState } from 'react';

import {
  ENERGY_COST_STATISTIC_IDS,
  ENERGY_DAILY_DAYS,
  ENERGY_HOURLY_HOURS,
  ENERGY_REFRESH_MS,
  ENERGY_TOTAL_STATISTIC_ID,
} from '@/config/energy';
import { useHomeAssistantContext } from '@/providers/home-assistant-provider';

export type EnergyPeriod = 'hour' | 'day';

export const ENERGY_PERIODS: EnergyPeriod[] = ['hour', 'day'];

/** How many buckets each scale shows. */
export const PERIOD_COUNT: Record<EnergyPeriod, number> = {
  hour: ENERGY_HOURLY_HOURS,
  day: ENERGY_DAILY_DAYS,
};

const HOUR_MS = 3600 * 1000;
const PERIOD_MS: Record<EnergyPeriod, number> = { hour: HOUR_MS, day: 24 * HOUR_MS };

/**
 * One period of a statistic. `start` and `end` are the recorder's own bucket bounds — a
 * day runs midnight to midnight in the house's timezone — so callers never have to reckon
 * a day boundary themselves, which the tablet's clock and zone can't be trusted to do.
 */
export interface EnergyBucket {
  start: Date;
  end: Date;
  /** What the source measures over that period: kWh, or dollars for a cost counter. */
  value: number;
  /** The current period, still accumulating. */
  partial: boolean;
}

/**
 * Which recorder statistic backs a chart. An energy counter is the accurate source; a power
 * sensor is the fallback for a device that reports draw but never totals it. A cost counter
 * resets daily, so its closing value is the period's figure.
 */
export type EnergySource =
  | { kind: 'energy'; statisticId: string }
  | { kind: 'power'; statisticId: string }
  | { kind: 'cost'; statisticId: string };

/** Buckets per statistic id, for one period. */
export type EnergySeries = Record<string, EnergyBucket[]>;

/**
 * One period's figure from a statistics row.
 *
 * For a `total_increasing` counter the `sum` only ever climbs; the `change` field is what
 * was used within the period. A daily-resetting cost counter is read by its last `state`
 * in the period instead — its change across midnight is meaningless. For a plain power
 * sensor the recorder keeps only `mean`, so the energy is mean watts × the hours the period
 * spans, or only what has elapsed of the current one.
 */
function rowValue(kind: EnergySource['kind'], row: any, hours: number) {
  if (kind === 'energy') return Number(row.change ?? 0);
  if (kind === 'cost') return Number(row.state ?? 0);
  return (Number(row.mean ?? 0) * hours) / 1000;
}

function toBucket(source: EnergySource, row: any, period: EnergyPeriod, now: Date): EnergyBucket {
  const start = new Date(row.start);
  const end = new Date(row.end ?? row.start + PERIOD_MS[period]);
  const partial = end.getTime() > now.getTime();
  const elapsed = partial ? now.getTime() - start.getTime() : end.getTime() - start.getTime();
  return { start, end, partial, value: rowValue(source.kind, row, elapsed / HOUR_MS) };
}

/**
 * The running hour, folded from the recorder's 5-minute statistics. Hourly long-term
 * statistics are only compiled once the hour closes, so without this the hourly chart
 * would end at the previous hour and today's total would be short by up to an hour.
 */
function currentHourBucket(source: EnergySource, rows: any[], now: Date): EnergyBucket | null {
  if (rows.length === 0) return null;
  const start = new Date(rows[0].start);
  const end = new Date(start.getTime() + HOUR_MS);
  let value: number;
  if (source.kind === 'energy') {
    value = rows.reduce((sum, r) => sum + Number(r.change ?? 0), 0);
  } else if (source.kind === 'cost') {
    value = Number(rows[rows.length - 1].state ?? 0);
  } else {
    const mean = rows.reduce((sum, r) => sum + Number(r.mean ?? 0), 0) / rows.length;
    value = (mean * Math.min(1, (now.getTime() - start.getTime()) / HOUR_MS)) / 1000;
  }
  return { start, end, partial: true, value };
}

async function fetchPeriod(
  sendCommand: (message: Record<string, unknown>) => Promise<any>,
  sources: EnergySource[],
  period: EnergyPeriod,
  now: Date,
): Promise<EnergySeries> {
  const count = PERIOD_COUNT[period];
  const statistic_ids = sources.map((s) => s.statisticId);
  const types = ['change', 'mean', 'state'];

  // Plain instant arithmetic: the recorder aligns buckets to the house's own clock, so
  // asking from `count` periods ago yields the current bucket plus the `count - 1` before
  // it, whatever zone this device thinks it is in.
  const [response, recent] = await Promise.all([
    sendCommand({
      type: 'recorder/statistics_during_period',
      start_time: new Date(now.getTime() - count * PERIOD_MS[period]).toISOString(),
      statistic_ids,
      period,
      types,
    }),
    period === 'hour'
      ? sendCommand({
          type: 'recorder/statistics_during_period',
          start_time: new Date(now.getTime() - HOUR_MS).toISOString(),
          statistic_ids,
          period: '5minute',
          types,
        })
      : Promise.resolve(null),
  ]);

  const series: EnergySeries = {};
  for (const source of sources) {
    const rows: any[] = response?.[source.statisticId] ?? [];
    const buckets = rows
      .map((row) => toBucket(source, row, period, now))
      .filter((b) => Number.isFinite(b.value));
    if (recent && !buckets.some((b) => b.partial)) {
      // Only the 5-minute rows past the last compiled hour belong to the running one.
      const lastEnd = buckets.length ? buckets[buckets.length - 1].end.getTime() : 0;
      const fresh = (recent[source.statisticId] ?? []).filter((r: any) => r.start >= lastEnd);
      const running = currentHourBucket(source, fresh, now);
      if (running) buckets.push(running);
    }
    series[source.statisticId] = buckets.slice(-count);
  }
  return series;
}

/**
 * Consumption per hour and per day for a set of statistics, from the recorder's long-term
 * statistics — the right source rather than raw history, since the recorder keeps them well
 * past its purge window, so a week always resolves.
 *
 * Both scales are fetched together, so flipping a chart between hourly and daily is a
 * client-side switch with nothing to wait for. `byPeriod` is null until the first answer,
 * and the last answer stays up while a periodic refresh is in flight.
 */
export function useEnergyStatistics(sources: EnergySource[]) {
  const { status, clockSynced, sendCommand, serverNow } = useHomeAssistantContext();
  // Keyed by the request it answers, so a change of sources reads as loading rather than
  // briefly showing the previous chart under the new labels.
  const [result, setResult] = useState<{
    key: string;
    byPeriod: Record<EnergyPeriod, EnergySeries> | null;
    error: string | null;
  } | null>(null);

  const key = sources.map((s) => `${s.kind}:${s.statisticId}`).join(',');

  // Re-read on a timer: the running hour keeps growing, and past midnight "today" is a new
  // set of buckets entirely.
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), ENERGY_REFRESH_MS);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    // Waits for the clock: the windows below are reckoned from HA's "now", not the tablet's.
    if (status !== 'connected' || !clockSynced || !key) return;
    let cancelled = false;
    const wanted = key.split(',').map((part) => {
      const [kind, statisticId] = part.split(/:(.*)/s);
      return { kind, statisticId } as EnergySource;
    });

    (async () => {
      try {
        const now = serverNow();
        const [hour, day] = await Promise.all(
          ENERGY_PERIODS.map((period) => fetchPeriod(sendCommand, wanted, period, now)),
        );
        if (cancelled) return;
        setResult({ key, byPeriod: { hour, day }, error: null });
      } catch (e) {
        if (cancelled) return;
        setResult({
          key,
          byPeriod: null,
          error: e instanceof Error ? e.message : 'Failed to load energy history',
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [status, clockSynced, sendCommand, serverNow, key, tick]);

  const settled = result?.key === key ? result : null;
  return { byPeriod: settled?.byPeriod ?? null, error: settled?.error ?? null };
}

/** One statistic's buckets for each period — a device's chart. Null source means no data. */
export function useEnergySource(source: EnergySource | null) {
  // Keyed on the primitives: callers hand over a fresh object whenever a live reading
  // changes, and that must not refetch a week of statistics.
  const kind = source?.kind;
  const statisticId = source?.statisticId;
  const sources = useMemo<EnergySource[]>(
    () => (kind && statisticId ? [{ kind, statisticId }] : []),
    [kind, statisticId],
  );
  const { byPeriod, error } = useEnergyStatistics(sources);

  const buckets = useMemo(
    () =>
      byPeriod && statisticId
        ? { hour: byPeriod.hour[statisticId] ?? [], day: byPeriod.day[statisticId] ?? [] }
        : null,
    [byPeriod, statisticId],
  );

  return { buckets, error };
}

const HOUSE_TOTAL: EnergySource = { kind: 'energy', statisticId: ENERGY_TOTAL_STATISTIC_ID };
const COST_SOURCES: EnergySource[] = [
  HOUSE_TOTAL,
  ...ENERGY_COST_STATISTIC_IDS.map((statisticId) => ({ kind: 'cost' as const, statisticId })),
];

/** A recent day as the recorder bounds it, with the price of a kWh on it when known. */
export interface EnergyDay {
  /** Epoch ms. */
  start: number;
  end: number;
  rate: number | null;
}

/**
 * The recent days, oldest first, each with its effective price of a kWh: the day's bill
 * divided by the day's consumption. Hilo publishes cost per day only, so this is how an
 * hour, a device, or a category gets priced — its kWh at the rate of the day it fell on.
 * The access fee is in the bill, so it spreads across the day's kWh too.
 *
 * Null while loading. Days without a bill (no cost statistics) carry a null rate.
 */
export function useEnergyDays(): { days: EnergyDay[] | null; error: string | null } {
  const { byPeriod, error } = useEnergyStatistics(COST_SOURCES);

  const days = useMemo(() => {
    if (!byPeriod) return null;
    const costs =
      ENERGY_COST_STATISTIC_IDS.map((id) => byPeriod.day[id]).find((rows) => rows?.length) ?? [];
    const costByStart = new Map(costs.map((b) => [b.start.getTime(), b.value]));

    return (byPeriod.day[ENERGY_TOTAL_STATISTIC_ID] ?? []).map((day) => {
      const cost = costByStart.get(day.start.getTime());
      return {
        start: day.start.getTime(),
        end: day.end.getTime(),
        rate: cost !== undefined && day.value > 0 ? cost / day.value : null,
      };
    });
  }, [byPeriod]);

  return { days, error };
}

/** Whether any day has a bill — else charts show kWh. */
export function priced(days: EnergyDay[]) {
  return days.some((d) => d.rate !== null);
}

/** The rate of the day an instant falls on, else the average of the days that have one. */
export function rateFor(days: EnergyDay[], at: Date): number {
  const own = days.find((d) => at.getTime() >= d.start && at.getTime() < d.end)?.rate;
  if (own != null) return own;
  const known = days.flatMap((d) => (d.rate === null ? [] : [d.rate]));
  return known.length ? known.reduce((sum, r) => sum + r, 0) / known.length : 0;
}

/**
 * When today began, by the recorder's reckoning: the latest day it has. In the first hour
 * after midnight that day is not compiled yet, so HA's clock decides whether it is over.
 */
export function todayStart(days: EnergyDay[], now: number): number {
  const last = days[days.length - 1];
  if (!last) return 0;
  return now >= last.end ? last.end : last.start;
}
