import { useCallback, useEffect, useState } from 'react';

import { CALENDAR_ENTITY_IDS, TODO_ENTITY_ID } from '@/config/agenda';
import { useHomeAssistantContext } from '@/providers/home-assistant-provider';

export interface CalendarEvent {
  summary: string;
  /** Which calendar the event came from, since several are merged together. */
  calendar: string;
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

/** Sort key that puts an all-day event at the top of its own day. */
function startTime(event: CalendarEvent) {
  const raw = event.start.includes('T') ? event.start : `${event.start}T00:00:00`;
  const t = new Date(raw).getTime();
  return Number.isNaN(t) ? 0 : t;
}

export function useAgenda(monthStart: Date, monthEnd: Date) {
  const { status, sendCommand, subscribe } = useHomeAssistantContext();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [items, setItems] = useState<TodoItem[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [todosLoading, setTodosLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const rangeStart = formatLocal(monthStart);
  const rangeEnd = formatLocal(monthEnd);

  // The two fetches are deliberately kept apart: paging months changes the calendar range
  // only, so it must not re-fetch (or flash a spinner over) the todo list.
  const loadEvents = useCallback(async () => {
    setError(null);
    try {
      const result = await sendCommand({
        type: 'call_service',
        domain: 'calendar',
        service: 'get_events',
        service_data: { start_date_time: rangeStart, end_date_time: rangeEnd },
        target: { entity_id: CALENDAR_ENTITY_IDS },
        return_response: true,
      });

      // One key per targeted calendar. Merge them, then re-sort: HA sorts within a
      // calendar, but the concatenation of several is not itself in time order.
      const response = result?.response ?? {};
      const merged = Object.entries(response).flatMap(([entityId, calendar]: [string, any]) =>
        (calendar?.events ?? []).map((e: CalendarEvent) => ({ ...e, calendar: entityId })),
      );
      merged.sort((a, b) => startTime(a) - startTime(b));
      setEvents(merged);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load calendar');
    } finally {
      setEventsLoading(false);
    }
  }, [sendCommand, rangeStart, rangeEnd]);

  const loadTodos = useCallback(async () => {
    try {
      const result = await sendCommand({ type: 'todo/item/list', entity_id: TODO_ENTITY_ID });
      setItems(result?.items ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load tasks');
    } finally {
      setTodosLoading(false);
    }
  }, [sendCommand]);

  // Calendar: refetches on every month change, plus whenever a calendar entity changes.
  useEffect(() => {
    if (status !== 'connected') return;
    let cancelled = false;
    setEventsLoading(true);
    loadEvents().catch(() => {});

    // Server-side filtered subscription: HA only pushes when these entities change,
    // rather than us sifting the whole state_changed firehose.
    const unsubscribe = subscribe(
      { type: 'subscribe_trigger', trigger: { platform: 'state', entity_id: CALENDAR_ENTITY_IDS } },
      () => {
        if (!cancelled) loadEvents().catch(() => {});
      },
    );

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [status, loadEvents, subscribe]);

  // Todos: tied to the connection only — month paging leaves this effect untouched.
  useEffect(() => {
    if (status !== 'connected') return;
    let cancelled = false;
    setTodosLoading(true);
    loadTodos().catch(() => {});

    const unsubscribe = subscribe(
      { type: 'subscribe_trigger', trigger: { platform: 'state', entity_id: TODO_ENTITY_ID } },
      () => {
        if (!cancelled) loadTodos().catch(() => {});
      },
    );

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [status, loadTodos, subscribe]);

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
        loadTodos().catch(() => {});
        throw e;
      }
    },
    [sendCommand, loadTodos],
  );

  return {
    events,
    items,
    eventsLoading,
    todosLoading,
    error,
    connected: status === 'connected',
    refreshEvents: loadEvents,
    refreshTodos: loadTodos,
    setItemStatus,
  };
}
