import { useMemo } from 'react';

import type { Room } from '@/config/home';
import { useHomeAssistantContext } from '@/providers/home-assistant-provider';

export interface PresenceState {
  detected: boolean;
  /** False while the sensor has not reported, or has gone unavailable. */
  available: boolean;
}

/**
 * Occupancy per room, for the little person marker on the cards and modals.
 *
 * Rooms without a `presenceDeviceId` are absent from the map rather than reported as empty:
 * "nobody here" and "no sensor here" are different things, and only the first deserves an
 * icon on the card.
 */
export function useRoomPresence(rooms: Room[]) {
  const { devices } = useHomeAssistantContext();

  return useMemo(() => {
    const byRoom = new Map<string, PresenceState>();

    for (const room of rooms) {
      if (!room.presenceDeviceId) continue;
      const device = devices.find((d) => d.id === room.presenceDeviceId);
      const sensor = device?.entities.find(
        (e) =>
          e.entityId.startsWith('binary_sensor.') && e.attributes?.device_class === 'occupancy',
      );

      byRoom.set(room.name, {
        detected: sensor?.state === 'on',
        available: !!sensor && sensor.state !== 'unavailable' && sensor.state !== null,
      });
    }

    return byRoom;
  }, [devices, rooms]);
}
