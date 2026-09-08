import { useEffect, useState } from 'react';

import { ENERGY_HISTORY_DAYS, ENERGY_STATISTIC_ID } from '@/config/home';
import { useHomeAssistantContext } from '@/providers/home-assistant-provider';

export interface EnergyDay {
  start: Date;
  /** kWh used during that day. */
  kwh: number;
  /** The current day, still accumulating. */
  partial: boolean;
}

/**
 * Daily whole-house consumption from the recorder's long-term statistics.
 *
 * The meter is a `total_increasing` sensor, so its `sum` only ever climbs; the `change` field
 * is what was used within each period, which is what the chart wants. Statistics are the
 * right source here rather than raw history — the recorder keeps them well past its purge
 * window, so a week always resolves.
 */
export function useDailyEnergy(days = ENERGY_HISTORY_DAYS) {
  const { status, sendCommand } = useHomeAssistantContext();
  const [entries, setEntries] = useState<EnergyDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status !== 'connected') return;
    let cancelled = false;

    (async () => {
      try {
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (days - 1));
        const result = await sendCommand({
          type: 'recorder/statistics_during_period',
          start_time: start.toISOString(),
          statistic_ids: [ENERGY_STATISTIC_ID],
          period: 'day',
          types: ['change'],
        });
        if (cancelled) return;

        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        const rows: any[] = result?.[ENERGY_STATISTIC_ID] ?? [];
        setEntries(
          rows
            .map((r) => {
              const at = new Date(r.start);
              return {
                start: at,
                kwh: Number(r.change ?? 0),
                partial:
                  new Date(at.getFullYear(), at.getMonth(), at.getDate()).getTime() === today,
              };
            })
            .filter((d) => Number.isFinite(d.kwh))
            .slice(-days),
        );
        setError(null);
        setLoading(false);
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : 'Failed to load energy history');
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [status, sendCommand, days]);

  return { entries, loading, error };
}
