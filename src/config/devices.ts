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
} as const;

export const WATCHED_DEVICES: WatchedDevice[] = [
  { id: DEVICE_IDS.weatherForecast, label: 'Weather forecast' },
  { id: DEVICE_IDS.gardenSoilSensor, label: 'Garden soil sensor' },
];
