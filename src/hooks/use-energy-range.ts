import { useCallback, useEffect, useMemo, useState } from 'react';

import { ENERGY_DAILY_DAYS, ENERGY_REFRESH_MS } from '@/config/energy';
import { useHomeAssistantContext } from '@/providers/home-assistant-provider';

export type EnergyPeriod = 'hour' | 'day';

/** What a chart is looking at: one day by the hour, or a run of days. */
export interface EnergyView {
  period: EnergyPeriod;
  /** 0 is today / the current week; 1 is yesterday / last week, and so on. */
  offset: number;
}

/** The instants a view spans, as the recorder bounds them: `[start, end)` in epoch ms. */
export interface EnergyRange {
  period: EnergyPeriod;
  start: number;
  end: number;
}

const HOUR_MS = 3600 * 1000;
const DAY_MS = 24 * HOUR_MS;

/** A zone's offset from UTC at an instant, in ms — e.g. -4 h in Montréal's summer. */
function zoneOffsetMs(at: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(at);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const wall = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  return wall - Math.floor(at.getTime() / 1000) * 1000;
}

/**
 * Midnight of the day an instant falls on, in the house's timezone — never the device's,
 * whose zone is not trusted. An unknown or unsupported zone degrades to the device's.
 */
export function startOfDay(at: Date, timeZone: string | null): Date {
  if (timeZone) {
    try {
      const offset = zoneOffsetMs(at, timeZone);
      const wall = new Date(at.getTime() + offset);
      const midnightWall = Date.UTC(wall.getUTCFullYear(), wall.getUTCMonth(), wall.getUTCDate());
      // The offset can differ at midnight from the one now (a DST day); one correction settles it.
      const guess = new Date(midnightWall - offset);
      return new Date(midnightWall - zoneOffsetMs(guess, timeZone));
    } catch {
      // Fall through to the device zone.
    }
  }
  return new Date(at.getFullYear(), at.getMonth(), at.getDate());
}

/** Midnight `days` days after a midnight, stepping through noon so DST can't land it an hour off. */
export function addDays(midnight: number, days: number, timeZone: string | null) {
  return startOfDay(new Date(midnight + days * DAY_MS + DAY_MS / 2), timeZone).getTime();
}

/**
 * The range a view spans right now, plus the controls to move it. Recomputed on a timer so
 * a wall tablet's "today" rolls over at midnight.
 */
export function useEnergyRange(view: EnergyView) {
  const { timeZone, serverNow } = useHomeAssistantContext();

  // The tick only forces a render; `today` below is what actually changes, at midnight.
  const [, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), ENERGY_REFRESH_MS);
    return () => clearInterval(timer);
  }, []);
  const today = startOfDay(serverNow(), timeZone).getTime();

  return useMemo<EnergyRange>(() => {
    if (view.period === 'hour') {
      const start = addDays(today, -view.offset, timeZone);
      return { period: 'hour', start, end: addDays(start, 1, timeZone) };
    }
    const end = addDays(today, 1 - view.offset * ENERGY_DAILY_DAYS, timeZone);
    return { period: 'day', start: addDays(end, -ENERGY_DAILY_DAYS, timeZone), end };
  }, [view.period, view.offset, timeZone, today]);
}

/** View state with the three moves a chart offers: back, forward, and home to today. */
export function useEnergyView(initial: EnergyPeriod = 'hour') {
  const [view, setView] = useState<EnergyView>({ period: initial, offset: 0 });
  const setPeriod = useCallback((period: EnergyPeriod) => setView({ period, offset: 0 }), []);
  const back = useCallback(() => setView((v) => ({ ...v, offset: v.offset + 1 })), []);
  const forward = useCallback(() => setView((v) => ({ ...v, offset: Math.max(v.offset - 1, 0) })), []);
  const home = useCallback(() => setView((v) => ({ ...v, offset: 0 })), []);
  return { view, setPeriod, back, forward, home };
}
