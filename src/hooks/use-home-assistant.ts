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

const MAX_EVENTS = 100;
const RECONNECT_BASE_DELAY_MS = 1000;
const RECONNECT_MAX_DELAY_MS = 30000;

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
  const subscriptionIdRef = useRef<number | null>(null);
  const pendingRegistryIdRef = useRef<number | null>(null);
  const pendingStatesIdRef = useRef<number | null>(null);
  // entity_id -> device_id, populated from the entity registry, restricted to watched devices
  const entityToDeviceRef = useRef<Map<string, string>>(new Map());
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
            entities: [...d.entities, { entityId, platform: '', state: null, lastChanged: null, ...patch }],
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
      setError(!HA_WS_URL ? 'Missing EXPO_PUBLIC_HA_URL in .env.local' : 'Missing EXPO_PUBLIC_HA_TOKEN in .env.local');
      return;
    }

    closedByUsRef.current = false;
    setStatus('connecting');
    setError(null);

    const ws = new WebSocket(HA_WS_URL);
    wsRef.current = ws;
    nextIdRef.current = 1;
    subscriptionIdRef.current = null;
    pendingRegistryIdRef.current = null;
    pendingStatesIdRef.current = null;
    entityToDeviceRef.current = new Map();
    setDevices(initialDevices());
    setEvents([]);

    ws.onmessage = (rawEvent) => {
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
          subscriptionIdRef.current = send({ type: 'subscribe_events', event_type: 'state_changed' });
          if (WATCHED_DEVICES.length > 0) {
            pendingRegistryIdRef.current = send({ type: 'config/entity_registry/list_for_display' });
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
          // HA has no server-side entity filter for subscribe_events, so every
          // state_changed event in the house arrives here — we only keep the ones
          // belonging to a watched device.
          if (msg.id !== subscriptionIdRef.current) break;
          const data = msg.event?.data;
          const entityId = data?.entity_id;
          if (!entityId || !entityToDeviceRef.current.has(entityId)) break;

          const newState = data.new_state?.state ?? null;
          const oldState = data.old_state?.state ?? null;
          const friendlyName =
            data.new_state?.attributes?.friendly_name ?? data.old_state?.attributes?.friendly_name;

          patchEntity(entityId, { name: friendlyName, state: newState, lastChanged: Date.now() });

          setEvents((prev) =>
            [
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
            ].slice(0, MAX_EVENTS),
          );
          break;
        }

        case 'result':
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
                list.push({ entityId: e.ei, name: e.en, platform: e.pl, state: null, lastChanged: null });
                seeded.set(e.di, list);
              }
              entityToDeviceRef.current = map;
              setDevices(
                WATCHED_DEVICES.map((d) => ({ id: d.id, label: d.label, entities: seeded.get(d.id) ?? [] })),
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
                  lastChanged: s.last_changed ? new Date(s.last_changed).getTime() : null,
                });
              }
            }
          } else if (msg.success === false && msg.error) {
            setError(`${msg.error.code}: ${msg.error.message}`);
          }
          break;

        default:
          break;
      }
    };

    ws.onerror = () => {
      setError('WebSocket error');
    };

    ws.onclose = () => {
      wsRef.current = null;
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

  return { status, haVersion, error, devices, events };
}

export type UseHomeAssistantResult = ReturnType<typeof useHomeAssistant>;
