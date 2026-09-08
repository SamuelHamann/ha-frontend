import { useEffect, useState } from 'react';

import { useHomeAssistantContext } from '@/providers/home-assistant-provider';

export interface HistoryPoint {
  /** Epoch ms. */
  at: number;
  value: number;
}

/**
 * A numeric sensor's recent history, for the small bar charts.
 *
 * `history/history_during_period` answers with the compressed form — `s` for the state and
 * `lu` for the last-updated epoch in float seconds. Non-numeric samples ('unavailable' after
 * a restart, say) are dropped rather than plotted as zero.
 */
export function useHistory(entityId: string | null, hours: number) {
  const { status, sendCommand } = useHomeAssistantContext();
  const [points, setPoints] = useState<HistoryPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status !== 'connected' || !entityId) return;
    let cancelled = false;

    (async () => {
      try {
        const end = new Date();
        const start = new Date(end.getTime() - hours * 3600 * 1000);
        const result = await sendCommand({
          type: 'history/history_during_period',
          start_time: start.toISOString(),
          end_time: end.toISOString(),
          entity_ids: [entityId],
          minimal_response: true,
          no_attributes: true,
        });
        if (cancelled) return;

        const series: any[] = result?.[entityId] ?? [];
        setPoints(
          series
            .map((p) => ({ at: (p.lu ?? 0) * 1000, value: Number(p.s) }))
            .filter((p) => Number.isFinite(p.value) && p.at > 0),
        );
        setError(null);
        setLoading(false);
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : 'Failed to load history');
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [status, sendCommand, entityId, hours]);

  return { points, loading, error };
}
