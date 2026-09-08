import { useMemo } from 'react';

import type { WatchedEntityState } from '@/hooks/use-home-assistant';
import { useHomeAssistantContext } from '@/providers/home-assistant-provider';

/**
 * One entity on a watched device.
 *
 * `gang` picks between several matching entities on the same device — the two halves of a
 * wall switch, say. They are ordered by entity id, because the registry's own order is not
 * guaranteed and "gang 1" has to mean the same physical switch every time.
 *
 * `domains` is a comma-separated list rather than an array so the memo key stays a primitive.
 */
export function useDeviceEntity(
  deviceId: string,
  domains: string,
  gang = 0,
  deviceClass?: string,
): WatchedEntityState | null {
  const { devices } = useHomeAssistantContext();

  return useMemo(() => {
    const device = devices.find((d) => d.id === deviceId);
    if (!device) return null;

    const wanted = domains.split(',');
    const matches = device.entities
      .filter((e) => wanted.includes(e.entityId.split('.')[0]))
      .filter((e) => !deviceClass || e.attributes?.device_class === deviceClass)
      .sort((a, b) => a.entityId.localeCompare(b.entityId));

    return matches[gang] ?? null;
  }, [devices, deviceId, domains, gang, deviceClass]);
}

/** Calls a Home Assistant service against one entity. */
export function useCallService() {
  const { sendCommand } = useHomeAssistantContext();

  return useMemo(
    () =>
      (domain: string, service: string, entityId: string, data?: Record<string, unknown>) =>
        sendCommand({
          type: 'call_service',
          domain,
          service,
          target: { entity_id: entityId },
          service_data: data ?? {},
        }),
    [sendCommand],
  );
}
