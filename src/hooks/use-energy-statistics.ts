import { useEffect, useMemo, useState } from 'react';

import {
  ENERGY_COST_STATISTIC_IDS,
  ENERGY_REFRESH_MS,
  ENERGY_TOTAL_STATISTIC_ID,
} from '@/config/energy';
import type { EnergyPeriod, EnergyRange } from '@/hooks/use-energy-range';
import { useHomeAssistantContext } from '@/providers/home-assistant-provider';

export type { EnergyPeriod, EnergyRange } from '@/hooks/use-energy-range';

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

/** Buckets per statistic id, for one range. */
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
 * statistics are only compiled once the hour closes, so without this today's chart would
 * end at the previous hour and its total would be short by up to an hour.
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

async function fetchRange(
  sendCommand: (message: Record<string, unknown>) => Promise<any>,
  sources: EnergySource[],
  range: EnergyRange,
  now: Date,
): Promise<EnergySeries> {
  const statistic_ids = sources.map((s) => s.statisticId);
  const types = ['change', 'mean', 'state'];
  // The running hour only exists in a day that is still going.
  const live = range.period === 'hour' && range.end > now.getTime() && range.start <= now.getTime();

  const [response, recent] = await Promise.all([
    sendCommand({
      type: 'recorder/statistics_during_period',
      start_time: new Date(range.start).toISOString(),
      end_time: new Date(range.end).toISOString(),
      statistic_ids,
      period: range.period,
      types,
    }),
    live
      ? sendCommand({
          type: 'recorder/statistics_during_period',
          start_time: new Date(Math.max(now.getTime() - HOUR_MS, range.start)).toISOString(),
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
      .map((row) => toBucket(source, row, range.period, now))
      // The recorder counts a bucket that starts exactly at `end_time` as inside the range.
      .filter((b) => Number.isFinite(b.value) && b.start.getTime() < range.end);
    if (recent && !buckets.some((b) => b.partial)) {
      // Only the 5-minute rows past the last compiled hour belong to the running one.
      const lastEnd = buckets.length ? buckets[buckets.length - 1].end.getTime() : 0;
      const fresh = (recent[source.statisticId] ?? []).filter((r: any) => r.start >= lastEnd);
      const running = currentHourBucket(source, fresh, now);
      if (running) buckets.push(running);
    }
    series[source.statisticId] = buckets;
  }
  return series;
}

type Answer = { series: EnergySeries | null; error: string | null };

/**
 * Statistics for a set of sources over one range, from the recorder's long-term
 * statistics — the right source rather than raw history, since the recorder keeps them
 * well past its purge window, so any week resolves.
 *
 * Answers are cached by request, so stepping back to a day already seen is instant. While
 * a new range loads the last answer shown stays up, flagged `loading`, so a chart can keep
 * its bars rather than blink to a spinner. The range on screen is re-read on a timer,
 * keeping the running hour and today's total moving.
 */
export function useEnergyStatistics(sources: EnergySource[], range: EnergyRange | null) {
  const { status, clockSynced, sendCommand, serverNow } = useHomeAssistantContext();
  const [cache, setCache] = useState<Map<string, Answer>>(() => new Map());

  const sourcesKey = sources.map((s) => `${s.kind}:${s.statisticId}`).join(',');
  // No sources (a closed modal, say) means nothing to ask for.
  const key = range && sourcesKey ? `${sourcesKey}|${range.period}|${range.start}|${range.end}` : '';

  const [tick, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), ENERGY_REFRESH_MS);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    // Waits for the clock: which hour is still running is judged by HA's "now", not the tablet's.
    if (status !== 'connected' || !clockSynced || !key || !range) return;
    let cancelled = false;
    const wanted = sourcesKey.split(',').map((part) => {
      const [kind, statisticId] = part.split(/:(.*)/s);
      return { kind, statisticId } as EnergySource;
    });

    (async () => {
      let answer: Answer;
      try {
        answer = { series: await fetchRange(sendCommand, wanted, range, serverNow()), error: null };
      } catch (e) {
        answer = {
          series: null,
          error: e instanceof Error ? e.message : 'Failed to load energy history',
        };
      }
      if (cancelled) return;
      setCache((prev) => new Map(prev).set(key, answer));
    })();

    return () => {
      cancelled = true;
    };
    // `range` is fully described by `key`; `sourcesKey` likewise.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, clockSynced, sendCommand, serverNow, key, tick]);

  // The key whose answer is on screen: this one as soon as it has answered, else the last
  // one that had. Updated during render, as derived state is.
  const [shownKey, setShownKey] = useState(key);
  if (key !== shownKey && cache.has(key)) setShownKey(key);

  const answer = cache.get(key) ?? cache.get(shownKey);
  return {
    series: answer?.series ?? null,
    error: answer?.error ?? null,
    /** True while the requested range has no answer yet; `series` is then the last shown. */
    loading: !cache.has(key),
  };
}

/** One statistic's buckets over a range — a device's chart. Null source means no data. */
export function useEnergySource(source: EnergySource | null, range: EnergyRange) {
  // Keyed on the primitives: callers hand over a fresh object whenever a live reading
  // changes, and that must not refetch a week of statistics.
  const kind = source?.kind;
  const statisticId = source?.statisticId;
  const sources = useMemo<EnergySource[]>(
    () => (kind && statisticId ? [{ kind, statisticId }] : []),
    [kind, statisticId],
  );
  const { series, error, loading } = useEnergyStatistics(sources, range);
  return { buckets: series && statisticId ? (series[statisticId] ?? []) : null, error, loading };
}

const HOUSE_TOTAL: EnergySource = { kind: 'energy', statisticId: ENERGY_TOTAL_STATISTIC_ID };
const COST_SOURCES: EnergySource[] = [
  HOUSE_TOTAL,
  ...ENERGY_COST_STATISTIC_IDS.map((statisticId) => ({ kind: 'cost' as const, statisticId })),
];

/** A day as the recorder bounds it, with the price of a kWh on it when known. */
export interface EnergyDay {
  /** Epoch ms. */
  start: number;
  end: number;
  rate: number | null;
}

/**
 * The days a range covers, each with its effective price of a kWh: the day's bill divided
 * by the day's consumption. Hilo publishes cost per day only, so this is how an hour, a
 * device, or a category gets priced — its kWh at the rate of the day it fell on. The
 * access fee is in the bill, so it spreads across the day's kWh too.
 *
 * Null while loading. Days without a bill (no cost statistics) carry a null rate.
 */
export function useEnergyDays(range: EnergyRange): {
  days: EnergyDay[] | null;
  error: string | null;
  loading: boolean;
} {
  const dayRange = useMemo<EnergyRange>(
    () => ({ period: 'day', start: range.start, end: range.end }),
    [range.start, range.end],
  );
  const { series, error, loading } = useEnergyStatistics(COST_SOURCES, dayRange);

  const days = useMemo(() => {
    if (!series) return null;
    const costs =
      ENERGY_COST_STATISTIC_IDS.map((id) => series[id]).find((rows) => rows?.length) ?? [];
    const costByStart = new Map(costs.map((b) => [b.start.getTime(), b.value]));

    return (series[ENERGY_TOTAL_STATISTIC_ID] ?? []).map((day) => {
      const cost = costByStart.get(day.start.getTime());
      return {
        start: day.start.getTime(),
        end: day.end.getTime(),
        rate: cost !== undefined && day.value > 0 ? cost / day.value : null,
      };
    });
  }, [series]);

  return { days, error, loading };
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
