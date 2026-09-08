import { useCallback, useMemo } from 'react';

import type { Room } from '@/config/home';
import { useHomeAssistantContext } from '@/providers/home-assistant-provider';

export interface RoomLightState {
  /** Absent when the room has no light wired up — the card renders a dead button. */
  entityId: string | null;
  on: boolean;
  /** True once the entity exists but is unreachable. */
  unavailable: boolean;
}

/** Entities on a device that can be switched, in a stable order so "gang 1" always means
 * the same physical switch. The registry's own order is not guaranteed. */
function switchableEntities(entityIds: string[]) {
  return entityIds.filter((id) => /^(light|switch)\./.test(id)).sort();
}

export function useRoomLights(rooms: Room[]) {
  const { devices, sendCommand } = useHomeAssistantContext();

  const states = useMemo(() => {
    const byRoom = new Map<string, RoomLightState>();

    for (const room of rooms) {
      if (!room.light) {
        byRoom.set(room.name, { entityId: null, on: false, unavailable: false });
        continue;
      }

      const device = devices.find((d) => d.id === room.light!.deviceId);
      const candidates = switchableEntities((device?.entities ?? []).map((e) => e.entityId));
      const entityId = candidates[room.light.gang] ?? null;
      const entity = device?.entities.find((e) => e.entityId === entityId);

      byRoom.set(room.name, {
        entityId,
        on: entity?.state === 'on',
        unavailable: entity?.state === 'unavailable',
      });
    }

    return byRoom;
  }, [devices, rooms]);

  /** Flips the room's light. The state comes back over the existing subscription, so there
   * is nothing to update here. */
  const toggle = useCallback(
    async (entityId: string) => {
      const domain = entityId.split('.')[0];
      await sendCommand({
        type: 'call_service',
        domain,
        service: 'toggle',
        target: { entity_id: entityId },
      });
    },
    [sendCommand],
  );

  return { states, toggle };
}
