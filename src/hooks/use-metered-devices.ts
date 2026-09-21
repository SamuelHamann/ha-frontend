import { useMemo } from 'react';

import type { MeteredDevice } from '@/config/energy';
import { numericState } from '@/hooks/use-entity';
import type { EnergySource } from '@/hooks/use-energy-statistics';
import { useHomeAssistantContext } from '@/providers/home-assistant-provider';

export interface MeteredDeviceState extends MeteredDevice {
  /** Live draw in `unit`, or null when the power sensor hasn't reported yet. */
  watts: number | null;
  unit: string;
  /** What backs the device's consumption chart, or null when nothing on it is recorded. */
  source: EnergySource | null;
}

/**
 * Live draw for a list of metered devices, in the order given.
 *
 * The power sensor is resolved from the watched device by its `power` device class. The
 * chart source prefers the configured energy counter, then an `energy` sensor on the device
 * itself, and finally the power sensor's own recorded mean.
 */
export function useMeteredDevices(list: MeteredDevice[]): MeteredDeviceState[] {
  const { devices } = useHomeAssistantContext();

  return useMemo(
    () =>
      list.map((item) => {
        const device = devices.find((d) => d.id === item.deviceId);
        const sensors = device?.entities.filter((e) => e.entityId.startsWith('sensor.')) ?? [];
        const power = sensors.find((e) => e.attributes?.device_class === 'power');
        const energy = sensors.find((e) => e.attributes?.device_class === 'energy');

        const energyId = item.energyEntityId ?? energy?.entityId;
        const source: EnergySource | null = energyId
          ? { kind: 'energy', statisticId: energyId }
          : power
            ? { kind: 'power', statisticId: power.entityId }
            : null;

        return {
          ...item,
          watts: numericState(power),
          unit: power?.attributes?.unit_of_measurement ?? 'W',
          source,
        };
      }),
    [devices, list],
  );
}
