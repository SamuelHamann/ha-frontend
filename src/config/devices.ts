/**
 * Devices the app listens to and displays. Not secret, so this file is git-tracked —
 * add/remove entries directly. Find a device_id in Home Assistant via
 * Settings > Devices & services > (device) > URL bar (…/config/devices/device/<id>).
 */
export interface WatchedDevice {
  id: string;
  /** Optional display name override; falls back to the entity's own name. */
  label?: string;
}

/**
 * Named ids, so screens can reference a specific device without pasting a raw hash.
 * Keep these in sync with WATCHED_DEVICES below.
 */
export const DEVICE_IDS = {
  /** Weather forecast source, used by the Weather page. */
  weatherForecast: '9d09db7655dd3d2e84828d2504d427bd',
  /** Garden soil sensor (moisture/temperature). */
  gardenSoilSensor: '43774a897b41752d4c35453e07e3f68c',
  /** Hilo "Meter00" — the whole-house power meter, used by the Home page. */
  powerMeter: '8e722c5123c2a349d8ba10834a0797d1',
  /** TP-Link "Outdoor pool plug" — a two-outlet plug; outlet 1 drives the pool pump. */
  poolPlug: '52e7d6ea587cdab5c86d41901a7c6685',
  /** SONOFF "Outdoor - Pool Thermometer" — probe in the pool. */
  poolThermometer: '1f8245a9507e53ad512f47ffff0769dd',
} as const;

export const WATCHED_DEVICES: WatchedDevice[] = [
  { id: DEVICE_IDS.weatherForecast, label: 'Weather forecast' },
  { id: DEVICE_IDS.gardenSoilSensor, label: 'Garden soil sensor' },
  { id: DEVICE_IDS.powerMeter, label: 'Power meter' },
  { id: DEVICE_IDS.poolPlug, label: 'Pool plug' },
  { id: DEVICE_IDS.poolThermometer, label: 'Pool thermometer' },
];
