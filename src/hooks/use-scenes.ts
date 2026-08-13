import { useCallback, useEffect, useState } from 'react';

import { useHomeAssistantContext } from '@/providers/home-assistant-provider';

export interface Scene {
  entityId: string;
  name: string;
  /** ISO timestamp of last activation, or null if never activated. */
  lastActivated: string | null;
}

export interface SceneGroup {
  areaId: string | null;
  areaName: string;
  scenes: Scene[];
}

const UNASSIGNED = 'Unassigned';

export function useScenes() {
  const { status, sendCommand } = useHomeAssistantContext();
  const [groups, setGroups] = useState<SceneGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Not connected yet: stay in the loading state, but don't claim to be fetching —
    // the screen reports the connection status instead of spinning with no explanation.
    if (status !== 'connected') return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const [states, entityRegistry, areaRegistry] = await Promise.all([
          sendCommand({ type: 'get_states' }),
          sendCommand({ type: 'config/entity_registry/list_for_display' }),
          sendCommand({ type: 'config/area_registry/list' }),
        ]);
        if (cancelled) return;

        // entity_id -> area_id, from the registry's abbreviated keys (ei/ai).
        const entityArea = new Map<string, string>();
        for (const e of entityRegistry?.entities ?? []) {
          if (e.ai) entityArea.set(e.ei, e.ai);
        }
        const areaNames = new Map<string, string>(
          (areaRegistry ?? []).map((a: any) => [a.area_id, a.name]),
        );

        // get_states is authoritative for which scenes exist — YAML-defined scenes may not
        // have entity registry entries, so never build the list from the registry alone.
        const byArea = new Map<string | null, Scene[]>();
        for (const s of states ?? []) {
          if (!s.entity_id.startsWith('scene.')) continue;
          const areaId = entityArea.get(s.entity_id) ?? null;
          const scene: Scene = {
            entityId: s.entity_id,
            name: s.attributes?.friendly_name ?? s.entity_id.replace(/^scene\./, ''),
            // A scene's state is the timestamp it was last applied ('unknown' if never).
            lastActivated: s.state && s.state !== 'unknown' ? s.state : null,
          };
          byArea.set(areaId, [...(byArea.get(areaId) ?? []), scene]);
        }

        const next: SceneGroup[] = [...byArea.entries()]
          .map(([areaId, scenes]) => ({
            areaId,
            areaName: areaId ? (areaNames.get(areaId) ?? areaId) : UNASSIGNED,
            scenes: scenes.sort((a, b) => a.name.localeCompare(b.name)),
          }))
          // Alphabetical, with Unassigned pinned last.
          .sort((a, b) => {
            if (a.areaId === null) return 1;
            if (b.areaId === null) return -1;
            return a.areaName.localeCompare(b.areaName);
          });

        setGroups(next);
        setLoading(false);
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : 'Failed to load scenes');
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [status, sendCommand]);

  /**
   * Applies a scene for real (`scene.turn_on`). HA sets the scene's state to the activation
   * timestamp, so we reflect that locally rather than refetching everything.
   */
  const activateScene = useCallback(
    async (entityId: string) => {
      await sendCommand({
        type: 'call_service',
        domain: 'scene',
        service: 'turn_on',
        target: { entity_id: entityId },
      });
      setGroups((prev) =>
        prev.map((g) => ({
          ...g,
          scenes: g.scenes.map((s) =>
            s.entityId === entityId ? { ...s, lastActivated: new Date().toISOString() } : s,
          ),
        })),
      );
    },
    [sendCommand],
  );

  return { groups, loading, error, connected: status === 'connected', activateScene };
}
