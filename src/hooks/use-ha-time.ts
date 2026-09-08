import { useCallback, useEffect, useMemo, useState } from 'react';

import { HA_TIME_ENTITY_IDS } from '@/config/home';
import { useEntities } from '@/hooks/use-entity';
import { useHomeAssistantContext } from '@/providers/home-assistant-provider';

/**
 * Where the displayed time came from.
 *  - `ha`: date and time both from Home Assistant.
 *  - `ha-time`: HA supplied the time, the device supplied the date.
 *  - `device`: no HA clock sensor; the tablet's clock, shown in HA's timezone.
 */
export type ClockSource = 'ha' | 'ha-time' | 'device';

export interface HaClock {
  now: Date;
  source: ClockSource;
  /** HA's configured timezone, e.g. 'America/Toronto'. */
  timeZone?: string;
  /** Format `now` the right way for whichever source produced it. */
  format: (options: Intl.DateTimeFormatOptions) => string;
  /** Format a true instant (an entity timestamp, say) in HA's timezone. */
  formatInstant: (date: Date, options: Intl.DateTimeFormatOptions) => string;
}

const CANDIDATES = Object.values(HA_TIME_ENTITY_IDS);

/**
 * Whether an ISO string carries a UTC offset, and so denotes a real instant.
 *
 * HA's `date_time_iso` sensor emits local time *without* an offset ('2026-09-07T22:07:00'),
 * which `Date` then reads in the device's zone — already the home's wall clock. Re-applying
 * HA's timezone when formatting such a value would shift it a second time, so the offset in
 * the string, not the sensor it came from, decides how it is rendered.
 */
function hasUtcOffset(value: string) {
  return /(?:Z|[+-]\d{2}:?\d{2})$/.test(value.trim());
}

/** 'HH:MM' or 'HH:MM:SS' -> [hours, minutes], or null. */
function parseClockTime(value?: string | null) {
  const match = /^(\d{1,2}):(\d{2})/.exec(value ?? '');
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  return hours < 24 && minutes < 60 ? ([hours, minutes] as const) : null;
}

function valid(date: Date | null) {
  return date && !Number.isNaN(date.getTime()) ? date : null;
}

/**
 * The clock the Home page runs on.
 *
 * Prefers Home Assistant's own `time_date` sensors, so the wall panel shows the house's time
 * even when the tablet's clock is wrong, and falls back to the tablet clock rendered in HA's
 * configured timezone.
 *
 * The distinction that matters for formatting: `sensor.date_time_iso` carries a UTC offset,
 * so it is a real instant and gets rendered in HA's timezone. The other sensors are already
 * the home's wall clock, so re-applying a timezone to them would shift the time a second
 * time — `format` handles that, and callers should use it rather than formatting `now`.
 */
export function useHaTime(): HaClock {
  const { status, sendCommand } = useHomeAssistantContext();
  const [timeZone, setTimeZone] = useState<string | undefined>();
  const [tick, setTick] = useState(() => new Date());
  const states = useEntities(CANDIDATES);

  // Ticks on the minute boundary rather than every 60s from mount, so the displayed minute
  // flips when the real one does. Also drives the fallback clock.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const msToNextMinute = (from: Date) =>
      60000 - (from.getSeconds() * 1000 + from.getMilliseconds());
    const run = () => {
      const next = new Date();
      setTick(next);
      timer = setTimeout(run, msToNextMinute(next));
    };
    timer = setTimeout(run, msToNextMinute(new Date()));
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (status !== 'connected') return;
    let cancelled = false;
    sendCommand({ type: 'get_config' })
      .then((config: any) => {
        if (!cancelled) setTimeZone(config?.time_zone || undefined);
      })
      .catch(() => {
        // Non-fatal: without it we format in the device's own zone.
      });
    return () => {
      cancelled = true;
    };
  }, [status, sendCommand]);

  const { now, source, isInstant } = useMemo(() => {
    const stateOf = (id: string) => states[id]?.state ?? null;

    // 1. Full ISO date and time. Only an offset-bearing value is a real instant.
    const isoState = stateOf(HA_TIME_ENTITY_IDS.iso);
    const iso = valid(isoState ? new Date(isoState) : null);
    if (iso) {
      return { now: iso, source: 'ha' as ClockSource, isInstant: hasUtcOffset(isoState!) };
    }

    // 2. 'YYYY-MM-DD, HH:MM' — the home's wall clock.
    const dateTime = stateOf(HA_TIME_ENTITY_IDS.dateTime);
    const combined = dateTime ? valid(new Date(dateTime.replace(', ', 'T'))) : null;
    if (combined) return { now: combined, source: 'ha' as ClockSource, isInstant: false };

    // 3. Separate date and time sensors.
    const time = parseClockTime(stateOf(HA_TIME_ENTITY_IDS.time));
    const date = stateOf(HA_TIME_ENTITY_IDS.date);
    if (time) {
      const day = date ? valid(new Date(`${date}T00:00:00`)) : null;
      const base = day ?? tick;
      return {
        now: new Date(base.getFullYear(), base.getMonth(), base.getDate(), time[0], time[1]),
        source: (day ? 'ha' : 'ha-time') as ClockSource,
        isInstant: false,
      };
    }

    // 4. Nothing from HA.
    return { now: tick, source: 'device' as ClockSource, isInstant: true };
  }, [states, tick]);

  /**
   * Renders in HA's timezone. An unsupported `timeZone` throws on RN engines without full
   * ICU, so that degrades to the device zone rather than blanking the value.
   */
  const formatInstant = useCallback(
    (date: Date, options: Intl.DateTimeFormatOptions) => {
      if (timeZone) {
        try {
          return date.toLocaleString([], { ...options, timeZone });
        } catch {
          // Fall through to the device zone.
        }
      }
      return date.toLocaleString([], options);
    },
    [timeZone],
  );

  /** `now` is only a real instant for an offset-bearing source; a wall clock is already in
   * the home's zone and must not be shifted again. */
  const format = useCallback(
    (options: Intl.DateTimeFormatOptions) =>
      isInstant ? formatInstant(now, options) : now.toLocaleString([], options),
    [now, isInstant, formatInstant],
  );

  return { now, source, timeZone, format, formatInstant };
}
