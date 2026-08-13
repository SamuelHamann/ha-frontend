import { useCallback, useEffect, useState } from 'react';

import { CALENDAR_ENTITY_ID, TODO_ENTITY_ID } from '@/config/agenda';
import { useHomeAssistantContext } from '@/providers/home-assistant-provider';

export interface CalendarEvent {
  summary: string;
  /** 'YYYY-MM-DD' for all-day events, ISO datetime otherwise. */
  start: string;
  end: string;
  location?: string;
  description?: string;
}

export interface TodoItem {
  uid: string;
  summary: string;
  status: 'needs_action' | 'completed' | string;
  /** 'YYYY-MM-DD' or ISO datetime; absent when the item has no due date. */
  due?: string;
  description?: string;
}

/** HA's calendar.get_events wants naive local time: 'YYYY-MM-DD HH:MM:SS'. */
function formatLocal(d: Date) {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(
    d.getMinutes(),
  )}:${p(d.getSeconds())}`;
}

export function useAgenda(monthStart: Date, monthEnd: Date) {
  const { status, sendCommand, subscribe } = useHomeAssistantContext();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [items, setItems] = useState<TodoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const rangeStart = formatLocal(monthStart);
  const rangeEnd = formatLocal(monthEnd);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [calendarResult, todoResult] = await Promise.all([
        sendCommand({
          type: 'call_service',
          domain: 'calendar',
          service: 'get_events',
          service_data: { start_date_time: rangeStart, end_date_time: rangeEnd },
          target: { entity_id: CALENDAR_ENTITY_ID },
          return_response: true,
        }),
        sendCommand({ type: 'todo/item/list', entity_id: TODO_ENTITY_ID }),
      ]);

      setEvents(calendarResult?.response?.[CALENDAR_ENTITY_ID]?.events ?? []);
      setItems(todoResult?.items ?? []);
      setLoading(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load agenda');
      setLoading(false);
    }
  }, [sendCommand, rangeStart, rangeEnd]);

  useEffect(() => {
    if (status !== 'connected') return;
    let cancelled = false;
    setLoading(true);
    load().catch(() => {});

    // Server-side filtered subscription: HA only pushes when these two entities change,
    // rather than us sifting the whole state_changed firehose.
    const unsubscribe = subscribe(
      {
        type: 'subscribe_trigger',
        trigger: { platform: 'state', entity_id: [CALENDAR_ENTITY_ID, TODO_ENTITY_ID] },
      },
      () => {
        if (!cancelled) load().catch(() => {});
      },
    );

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [status, load, subscribe]);

  /**
   * Tick a task off (or back on) in the real list. Applies optimistically so the tap feels
   * instant; the `subscribe_trigger` refetch reconciles with the server shortly after, and
   * a failure rolls the row back before surfacing the error.
   */
  const setItemStatus = useCallback(
    async (uid: string, nextStatus: 'completed' | 'needs_action') => {
      setItems((prev) => prev.map((i) => (i.uid === uid ? { ...i, status: nextStatus } : i)));
      try {
        await sendCommand({
          type: 'call_service',
          domain: 'todo',
          service: 'update_item',
          target: { entity_id: TODO_ENTITY_ID },
          // `item` takes the item's uid or its name; uid avoids ambiguity between
          // tasks that share a summary.
          service_data: { item: uid, status: nextStatus },
        });
      } catch (e) {
        // Resync from the server rather than restoring a captured snapshot, which could be
        // stale if another toggle or a trigger refetch landed in the meantime.
        load().catch(() => {});
        throw e;
      }
    },
    [sendCommand, load],
  );

  return {
    events,
    items,
    loading,
    error,
    connected: status === 'connected',
    refresh: load,
    setItemStatus,
  };
}
