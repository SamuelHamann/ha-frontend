import { useMemo } from 'react';

import { DEVICE_IDS } from '@/config/devices';
import { ENERGY_COST_STATISTIC_IDS } from '@/config/energy';
import { ENERGY_TODAY_ENTITY_IDS } from '@/config/home';
import { numericState, useEntities } from '@/hooks/use-entity';
import { useHomeAssistantContext } from '@/providers/home-assistant-provider';

/**
 * Live house power draw, plus the energy used and the money spent so far today.
 *
 * The meter is resolved from its watched device rather than a hardcoded entity id, so a
 * renamed entity doesn't break the page. Today's totals can't be: the Hilo daily meters and
 * cost sensor carry no device, so they're addressed by entity id — see
 * `ENERGY_TODAY_ENTITY_IDS` and `ENERGY_COST_STATISTIC_IDS`.
 */
export function usePower() {
  const { devices } = useHomeAssistantContext();

  const meter = useMemo(() => {
    const device = devices.find((d) => d.id === DEVICE_IDS.powerMeter);
    if (!device) return null;
    return (
      device.entities.find((e) => e.attributes?.device_class === 'power') ??
      device.entities[0] ??
      null
    );
  }, [devices]);

  const energy = useEntities(ENERGY_TODAY_ENTITY_IDS);
  const cost = useEntities(ENERGY_COST_STATISTIC_IDS);

  // One tariff bucket collects at a time; the day's use is the sum of all three. Stays null
  // until at least one has reported, so a fresh connection shows "—" rather than a bogus 0.
  const buckets = ENERGY_TODAY_ENTITY_IDS.map((id) => numericState(energy[id]));
  const kwhToday = buckets.some((v) => v !== null)
    ? buckets.reduce((total: number, v) => total + (v ?? 0), 0)
    : null;

  // The cost sensor may carry either of its ids (see the config); the first reporting wins.
  const costToday =
    ENERGY_COST_STATISTIC_IDS.map((id) => numericState(cost[id])).find((v) => v !== null) ?? null;

  return {
    watts: numericState(meter ?? undefined),
    unit: meter?.attributes?.unit_of_measurement ?? 'W',
    lastChanged: meter?.lastChanged ?? null,
    kwhToday,
    /** Today's bill so far, in dollars, or null until the cost sensor has reported. */
    costToday,
  };
}
