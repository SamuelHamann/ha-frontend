import { useMemo } from 'react';

import { THERMOSTATS } from '@/config/home';
import { useHomeAssistantContext } from '@/providers/home-assistant-provider';

export interface Thermostat {
  /** Fixed display name from the config, not HA's area name. */
  name: string;
  deviceId: string;
  /** Current room temperature in °C, or null when the entity hasn't reported yet. */
  current: number | null;
  /** Target temperature in °C. */
  target: number | null;
  /** Actively calling for heat right now, as opposed to merely being in heat mode. */
  heating: boolean;
  off: boolean;
}

function toNumber(value: unknown): number | null {
  const n = Number(value);
  return value === null || value === undefined || Number.isNaN(n) ? null : n;
}

/**
 * The room thermostats, in the fixed order set by THERMOSTATS.
 *
 * Each is resolved from its watched device rather than a hardcoded entity id; every one of
 * these devices carries exactly one `climate.*` entity, so no further tiebreak is needed.
 * The list length is constant, so a device that hasn't reported yet still renders a card.
 */
export function useThermostats(): Thermostat[] {
  const { devices } = useHomeAssistantContext();

  return useMemo(
    () =>
      THERMOSTATS.map(({ name, deviceId }) => {
        const device = devices.find((d) => d.id === deviceId);
        const entity = device?.entities.find((e) => e.entityId.startsWith('climate.'));
        const attributes = entity?.attributes ?? {};

        return {
          name,
          deviceId,
          current: toNumber(attributes.current_temperature),
          target: toNumber(attributes.temperature),
          // `hvac_action` is what the unit is doing now; the state only says which mode it
          // is in, and these all sit in 'heat' whether or not they are running.
          heating: attributes.hvac_action === 'heating',
          off: entity?.state === 'off',
        };
      }),
    [devices],
  );
}
