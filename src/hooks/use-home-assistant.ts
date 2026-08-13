import { useCallback, useEffect, useRef, useState } from 'react';

import { HA_TOKEN, HA_WS_URL } from '@/constants/ha-config';
import { WATCHED_DEVICES } from '@/config/devices';

export type ConnectionStatus =
  | 'idle'
  | 'connecting'
  | 'authenticating'
  | 'connected'
  | 'auth_invalid'
  | 'error'
  | 'closed';

export interface WatchedEntityState {
  entityId: string;
  name?: string;
  platform: string;
  state: string | null;
  attributes: Record<string, any>;
  lastChanged: number | null;
}

export interface WatchedDeviceState {
  id: string;
  label?: string;
  entities: WatchedEntityState[];
}

export interface StateChangedEvent {
  key: number;
  receivedAt: number;
  entityId: string;
  deviceId?: string;
  newState: string | null;
  oldState: string | null;
  friendlyName?: string;
}

/**
 * A caller-registered HA subscription (e.g. `weather/subscribe_forecast`). Kept in a
 * registry so it can be re-sent after a reconnect, since subscription ids don't survive
 * a dropped socket.
 */
interface ActiveSubscription {
  message: Record<string, unknown>;
  onEvent: (event: any) => void;
  id: number | null;
}

/** How long a state_changed event stays in the live log. */
export const EVENT_RETENTION_MS = 2 * 60 * 60 * 1000;
/** Sweep interval, so events age out during quiet periods too, not just on new traffic. */
const EVENT_PRUNE_INTERVAL_MS = 60 * 1000;
/** Safety bound on memory; age is the real policy, this only matters if traffic spikes. */
const MAX_EVENTS = 500;
const RECONNECT_BASE_DELAY_MS = 1000;
const RECONNECT_MAX_DELAY_MS = 30000;

/** Drops events past the retention window, returning the same array when nothing changed
 * so React can skip the re-render. */
function pruneEvents(events: StateChangedEvent[]): StateChangedEvent[] {
  const cutoff = Date.now() - EVENT_RETENTION_MS;
  const kept = events.filter((e) => e.receivedAt >= cutoff);
  return kept.length === events.length ? events : kept;
}

function initialDevices(): WatchedDeviceState[] {
  return WATCHED_DEVICES.map((d) => ({ id: d.id, label: d.label, entities: [] }));
}

export function useHomeAssistant() {
  const [status, setStatus] = useState<ConnectionStatus>('idle');
  const [haVersion, setHaVersion] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [events, setEvents] = useState<StateChangedEvent[]>([]);
  const [devices, setDevices] = useState<WatchedDeviceState[]>(initialDevices);

  const wsRef = useRef<WebSocket | null>(null);
  const nextIdRef = useRef(1);
  const nextEventKeyRef = useRef(1);
  const stateChangedSubIdRef = useRef<number | null>(null);
  const pendingRegistryIdRef = useRef<number | null>(null);
  const pendingStatesIdRef = useRef<number | null>(null);
  // entity_id -> device_id, populated from the entity registry, restricted to watched devices
  const entityToDeviceRef = useRef<Map<string, string>>(new Map());
  const subscriptionsRef = useRef<Set<ActiveSubscription>>(new Set());
  const pendingCommandsRef = useRef<
    Map<number, { resolve: (result: any) => void; reject: (err: Error) => void }>
  >(new Map());
  const reconnectAttemptRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closedByUsRef = useRef(false);

  const send = useCallback((message: Record<string, unknown>) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return null;
    const id = nextIdRef.current++;
    ws.send(JSON.stringify({ id, ...message }));
    return id;
  }, []);

  /**
   * Register a subscription command. Returns an unsubscribe function. Safe to call before
   * the socket is connected — it's sent on connect and re-sent after any reconnect.
   */
  const subscribe = useCallback(
    (message: Record<string, unknown>, onEvent: (event: any) => void) => {
      const sub: ActiveSubscription = { message, onEvent, id: null };
      subscriptionsRef.current.add(sub);
      sub.id = send(message);

      return () => {
        subscriptionsRef.current.delete(sub);
        if (sub.id !== null) send({ type: 'unsubscribe_events', subscription: sub.id });
      };
    },
    [send],
  );

  /**
   * Send a one-shot command and resolve with its `result`. Rejects if the socket isn't
   * open, if HA returns an error, or if the connection drops before the reply arrives.
   */
  const sendCommand = useCallback(
    (message: Record<string, unknown>) =>
      new Promise<any>((resolve, reject) => {
        const commandId = send(message);
        if (commandId === null) {
          reject(new Error('Not connected to Home Assistant'));
          return;
        }
        pendingCommandsRef.current.set(commandId, { resolve, reject });
      }),
    [send],
  );

  const patchEntity = useCallback((entityId: string, patch: Partial<WatchedEntityState>) => {
    const deviceId = entityToDeviceRef.current.get(entityId);
    if (!deviceId) return;
    setDevices((prev) =>
      prev.map((d) => {
        if (d.id !== deviceId) return d;
        const idx = d.entities.findIndex((e) => e.entityId === entityId);
        if (idx === -1) {
          return {
            ...d,
            entities: [
              ...d.entities,
              { entityId, platform: '', state: null, attributes: {}, lastChanged: null, ...patch },
            ],
          };
        }
        const nextEntities = d.entities.slice();
        nextEntities[idx] = { ...nextEntities[idx], ...patch };
        return { ...d, entities: nextEntities };
      }),
    );
  }, []);

  const connect = useCallback(() => {
    if (!HA_WS_URL || !HA_TOKEN) {
      setStatus('error');
      setError(
        !HA_WS_URL
          ? 'Missing EXPO_PUBLIC_HA_URL in .env.local'
          : 'Missing EXPO_PUBLIC_HA_TOKEN in .env.local',
      );
      return;
    }

    closedByUsRef.current = false;
    setStatus('connecting');
    setError(null);

    const ws = new WebSocket(HA_WS_URL);
    wsRef.current = ws;
    nextIdRef.current = 1;
    stateChangedSubIdRef.current = null;
    pendingRegistryIdRef.current = null;
    pendingStatesIdRef.current = null;
    entityToDeviceRef.current = new Map();
    setDevices(initialDevices());
    setEvents([]);

    ws.onmessage = (rawEvent) => {
      if (wsRef.current !== ws) return; // stale socket from a superseded connect()
      let msg: any;
      try {
        msg = JSON.parse(rawEvent.data as string);
      } catch {
        return;
      }

      switch (msg.type) {
        case 'auth_required':
          setStatus('authenticating');
          setHaVersion(msg.ha_version ?? null);
          ws.send(JSON.stringify({ type: 'auth', access_token: HA_TOKEN }));
          break;

        case 'auth_ok': {
          setStatus('connected');
          setHaVersion(msg.ha_version ?? null);
          reconnectAttemptRef.current = 0;
          stateChangedSubIdRef.current = send({
            type: 'subscribe_events',
            event_type: 'state_changed',
          });
          if (WATCHED_DEVICES.length > 0) {
            pendingRegistryIdRef.current = send({ type: 'config/entity_registry/list_for_display' });
          }
          // Re-establish caller subscriptions; their old ids died with the previous socket.
          for (const sub of subscriptionsRef.current) {
            sub.id = send(sub.message);
          }
          break;
        }

        case 'auth_invalid':
          setStatus('auth_invalid');
          setError(msg.message ?? 'Invalid access token');
          closedByUsRef.current = true;
          ws.close();
          break;

        case 'event': {
          // Caller-registered subscriptions (forecast, etc.) come first.
          for (const sub of subscriptionsRef.current) {
            if (sub.id === msg.id) {
              sub.onEvent(msg.event);
              return;
            }
          }

          // HA has no server-side entity filter for subscribe_events, so every
          // state_changed event in the house arrives here — we only keep the ones
          // belonging to a watched device.
          if (msg.id !== stateChangedSubIdRef.current) break;
          const data = msg.event?.data;
          const entityId = data?.entity_id;
          if (!entityId || !entityToDeviceRef.current.has(entityId)) break;

          const newState = data.new_state?.state ?? null;
          const oldState = data.old_state?.state ?? null;
          const attributes = data.new_state?.attributes ?? {};
          const friendlyName = attributes.friendly_name ?? data.old_state?.attributes?.friendly_name;

          patchEntity(entityId, {
            name: friendlyName,
            state: newState,
            attributes,
            lastChanged: Date.now(),
          });

          setEvents((prev) =>
            pruneEvents([
              {
                key: nextEventKeyRef.current++,
                receivedAt: Date.now(),
                entityId,
                deviceId: entityToDeviceRef.current.get(entityId),
                newState,
                oldState,
                friendlyName,
              },
              ...prev,
            ]).slice(0, MAX_EVENTS),
          );
          break;
        }

        case 'result': {
          const pendingCommand = pendingCommandsRef.current.get(msg.id);
          if (pendingCommand) {
            pendingCommandsRef.current.delete(msg.id);
            if (msg.success) pendingCommand.resolve(msg.result);
            else pendingCommand.reject(new Error(msg.error?.message ?? 'Command failed'));
            break;
          }

          if (msg.id === pendingRegistryIdRef.current) {
            pendingRegistryIdRef.current = null;
            if (msg.success) {
              const entities: any[] = msg.result?.entities ?? [];
              const watchedIds = new Set(WATCHED_DEVICES.map((d) => d.id));
              const map = new Map<string, string>();
              const seeded = new Map<string, WatchedEntityState[]>();
              for (const e of entities) {
                if (!e.di || !watchedIds.has(e.di)) continue;
                map.set(e.ei, e.di);
                const list = seeded.get(e.di) ?? [];
                list.push({
                  entityId: e.ei,
                  name: e.en,
                  platform: e.pl,
                  state: null,
                  attributes: {},
                  lastChanged: null,
                });
                seeded.set(e.di, list);
              }
              entityToDeviceRef.current = map;
              setDevices(
                WATCHED_DEVICES.map((d) => ({
                  id: d.id,
                  label: d.label,
                  entities: seeded.get(d.id) ?? [],
                })),
              );
              pendingStatesIdRef.current = send({ type: 'get_states' });
            } else if (msg.error) {
              setError(`${msg.error.code}: ${msg.error.message}`);
            }
          } else if (msg.id === pendingStatesIdRef.current) {
            pendingStatesIdRef.current = null;
            if (msg.success) {
              const states: any[] = msg.result ?? [];
              for (const s of states) {
                if (!entityToDeviceRef.current.has(s.entity_id)) continue;
                patchEntity(s.entity_id, {
                  state: s.state,
                  name: s.attributes?.friendly_name,
                  attributes: s.attributes ?? {},
                  lastChanged: s.last_changed ? new Date(s.last_changed).getTime() : null,
                });
              }
            }
          } else if (msg.success === false && msg.error) {
            setError(`${msg.error.code}: ${msg.error.message}`);
          }
          break;
        }

        default:
          break;
      }
    };

    ws.onerror = () => {
      if (wsRef.current !== ws) return;
      setError('WebSocket error');
    };

    ws.onclose = () => {
      // A superseded socket (fast refresh, StrictMode remount) must not clobber the
      // current one's ref, reject its in-flight commands, or trigger a stray reconnect.
      if (wsRef.current !== ws) return;
      wsRef.current = null;
      // Ids are meaningless once the socket is gone; connect() re-sends each subscription.
      for (const sub of subscriptionsRef.current) sub.id = null;
      // Nothing will ever answer these now — fail them instead of leaking pending promises.
      for (const [, p] of pendingCommandsRef.current) p.reject(new Error('Connection closed'));
      pendingCommandsRef.current.clear();
      if (closedByUsRef.current) {
        setStatus('closed');
        return;
      }
      setStatus('error');
      const attempt = reconnectAttemptRef.current++;
      const delay = Math.min(RECONNECT_BASE_DELAY_MS * 2 ** attempt, RECONNECT_MAX_DELAY_MS);
      reconnectTimerRef.current = setTimeout(connect, delay);
    };
  }, [send, patchEntity]);

  useEffect(() => {
    connect();
    return () => {
      closedByUsRef.current = true;
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      wsRef.current?.close();
    };
  }, [connect]);

  // Age events out on a timer as well as on arrival — otherwise a quiet house would leave
  // hours-old entries on screen until the next event happened to come in.
  useEffect(() => {
    const timer = setInterval(() => setEvents(pruneEvents), EVENT_PRUNE_INTERVAL_MS);
    return () => clearInterval(timer);
  }, []);

  return { status, haVersion, error, devices, events, subscribe, sendCommand };
}

export type UseHomeAssistantResult = ReturnType<typeof useHomeAssistant>;
