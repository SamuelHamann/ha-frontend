import { useEffect, useMemo, useState } from 'react';

import { DEVICE_IDS } from '@/config/devices';
import { useHomeAssistantContext } from '@/providers/home-assistant-provider';

/** One entry from HA's forecast list. Fields vary by integration; met.no supplies these. */
export interface ForecastEntry {
  datetime: string;
  condition?: string;
  temperature?: number;
  /** Daily entries only — the overnight low. */
  templow?: number;
  precipitation?: number;
  humidity?: number;
  uv_index?: number;
  wind_speed?: number;
  wind_bearing?: number;
  cloud_coverage?: number;
}

export interface CurrentWeather {
  condition: string | null;
  attributes: Record<string, any>;
}

export function useWeather() {
  const { devices, subscribe } = useHomeAssistantContext();
  const [hourly, setHourly] = useState<ForecastEntry[]>([]);
  const [daily, setDaily] = useState<ForecastEntry[]>([]);

  // The forecast device exposes exactly one `weather.*` entity; its state is the current
  // condition and its attributes carry current temp/humidity/wind/etc.
  const weatherEntity = useMemo(() => {
    const device = devices.find((d) => d.id === DEVICE_IDS.weatherForecast);
    return device?.entities.find((e) => e.entityId.startsWith('weather.')) ?? null;
  }, [devices]);

  const entityId = weatherEntity?.entityId;

  useEffect(() => {
    if (!entityId) return;

    const unsubHourly = subscribe(
      { type: 'weather/subscribe_forecast', entity_id: entityId, forecast_type: 'hourly' },
      (event) => setHourly(event?.forecast ?? []),
    );
    const unsubDaily = subscribe(
      { type: 'weather/subscribe_forecast', entity_id: entityId, forecast_type: 'daily' },
      (event) => setDaily(event?.forecast ?? []),
    );

    return () => {
      unsubHourly();
      unsubDaily();
    };
  }, [entityId, subscribe]);

  const current: CurrentWeather | null = weatherEntity
    ? { condition: weatherEntity.state, attributes: weatherEntity.attributes }
    : null;

  return { current, hourly, daily, entityId };
}
