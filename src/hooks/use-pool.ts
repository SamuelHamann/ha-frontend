import { useMemo } from 'react';

import { DEVICE_IDS } from '@/config/devices';
import { POOL_PUMP_SWITCH_SUFFIX } from '@/config/home';
import { useHomeAssistantContext } from '@/providers/home-assistant-provider';

export type PumpStatus = 'running' | 'off' | 'unknown';

/**
 * Pool pump state and water temperature, both resolved from their watched devices.
 *
 * The thermometer exposes one temperature sensor, so device_class is enough to find it. The
 * plug has two outlets, so the pump is picked by `POOL_PUMP_SWITCH_SUFFIX`.
 */
export function usePool() {
  const { devices } = useHomeAssistantContext();

  return useMemo(() => {
    const plug = devices.find((d) => d.id === DEVICE_IDS.poolPlug);
    const pump =
      plug?.entities.find(
        (e) => e.entityId.startsWith('switch.') && e.entityId.endsWith(POOL_PUMP_SWITCH_SUFFIX),
      ) ?? null;

    const thermometer = devices.find((d) => d.id === DEVICE_IDS.poolThermometer);
    const probe =
      thermometer?.entities.find(
        (e) => e.entityId.startsWith('sensor.') && e.attributes?.device_class === 'temperature',
      ) ?? null;

    const status: PumpStatus =
      pump?.state === 'on' ? 'running' : pump?.state === 'off' ? 'off' : 'unknown';

    // The probe reports Celsius; the panel shows Fahrenheit. Guard on the reported unit so a
    // probe switched to °F isn't converted twice.
    const reading = Number(probe?.state);
    const sourceUnit: string = probe?.attributes?.unit_of_measurement ?? '°C';
    const fahrenheit =
      probe?.state == null || Number.isNaN(reading)
        ? null
        : sourceUnit.includes('F')
          ? reading
          : reading * 1.8 + 32;

    return {
      status,
      temperature: fahrenheit,
      temperatureUnit: '°F',
      lastChanged: pump?.lastChanged ?? null,
    };
  }, [devices]);
}
