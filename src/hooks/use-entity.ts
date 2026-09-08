import { useEffect, useMemo, useState } from 'react';

import { useHomeAssistantContext } from '@/providers/home-assistant-provider';

export interface EntitySnapshot {
  state: string | null;
  attributes: Record<string, any>;
  /** Epoch ms of the last state change, or null before the first message arrives. */
  lastChanged: number | null;
}

export const EMPTY_ENTITY: EntitySnapshot = { state: null, attributes: {}, lastChanged: null };

/** `state` as a number, or null when the entity is missing, unknown or unavailable. */
export function numericState(snapshot?: EntitySnapshot): number | null {
  const n = Number(snapshot?.state);
  return snapshot?.state == null || snapshot.state === '' || Number.isNaN(n) ? null : n;
}

function applyAdd(prev: Record<string, EntitySnapshot>, added: Record<string, any>) {
  const next = { ...prev };
  for (const [id, s] of Object.entries(added)) {
    next[id] = {
      state: s?.s ?? null,
      attributes: s?.a ?? {},
      lastChanged: s?.lc ? s.lc * 1000 : null,
    };
  }
  return next;
}

function applyChange(prev: Record<string, EntitySnapshot>, changed: Record<string, any>) {
  const next = { ...prev };
  for (const [id, change] of Object.entries(changed)) {
    const patch = (change as any)?.['+'];
    if (!patch) continue;
    const current = next[id] ?? EMPTY_ENTITY;
    next[id] = {
      state: patch.s ?? current.state,
      attributes: patch.a ? { ...current.attributes, ...patch.a } : current.attributes,
      lastChanged: patch.lc ? patch.lc * 1000 : current.lastChanged,
    };
  }
  return next;
}

/**
 * Live state for entities that aren't part of a watched device.
 *
 * Uses `subscribe_entities`, which pushes each entity's full state immediately and then only
 * the fields that change — so there's no separate initial fetch, and none of the
 * `state_changed` firehose. Its payloads are the compressed form: `a` adds entities as
 * `{s: state, a: attributes, lc: lastChanged}`, and `c` reports changes as `+` (set) and
 * `-` (removed) patches.
 */
export function useEntities(entityIds: string[]): Record<string, EntitySnapshot> {
  const { subscribe } = useHomeAssistantContext();
  const [byId, setById] = useState<Record<string, EntitySnapshot>>({});
  // Callers pass a fresh array each render; the joined ids are what actually changes.
  const key = entityIds.join(',');

  useEffect(() => {
    const ids = key ? key.split(',') : [];
    if (ids.length === 0) return;

    return subscribe({ type: 'subscribe_entities', entity_ids: ids }, (event) => {
      if (event?.a) setById((prev) => applyAdd(prev, event.a));
      if (event?.c) setById((prev) => applyChange(prev, event.c));
    });
  }, [key, subscribe]);

  return byId;
}

export function useEntity(entityId: string): EntitySnapshot {
  const ids = useMemo(() => (entityId ? [entityId] : []), [entityId]);
  return useEntities(ids)[entityId] ?? EMPTY_ENTITY;
}
