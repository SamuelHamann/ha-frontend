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

  /**
   * Hilo thermostats, one per room. Each carries a single `climate.*` entity. The Home page
   * lists them in the order set by THERMOSTATS in `@/config/home`.
   */
  thermostatLivingRoom: '1b91ed162ae5347e9a4baae949a434f0',
  thermostatKitchen: '5cdda3975276e7a9814f5007fd292ef9',
  thermostatBedroom: '0774394ea1e9ffa29cfa2a3d85998916',
  thermostatOffice: 'abcf50e85f7f3b9f86aa4068d79eb202',
  thermostatGym: 'fb8229a8861a821d849458079a8b1025',
  thermostatBar: 'b7e78385cd8b27eb5adf2e8c58ef94a7',
  thermostatLaundry: 'b1984623323adde698d00ffded31a332',
} as const;

export const WATCHED_DEVICES: WatchedDevice[] = [
  { id: DEVICE_IDS.weatherForecast, label: 'Weather forecast' },
  { id: DEVICE_IDS.gardenSoilSensor, label: 'Garden soil sensor' },
  { id: DEVICE_IDS.powerMeter, label: 'Power meter' },
  { id: DEVICE_IDS.poolPlug, label: 'Pool plug' },
  { id: DEVICE_IDS.poolThermometer, label: 'Pool thermometer' },
  { id: DEVICE_IDS.thermostatLivingRoom, label: 'Thermostat — Living Room' },
  { id: DEVICE_IDS.thermostatKitchen, label: 'Thermostat — Kitchen' },
  { id: DEVICE_IDS.thermostatBedroom, label: 'Thermostat — Bedroom' },
  { id: DEVICE_IDS.thermostatOffice, label: 'Thermostat — Office' },
  { id: DEVICE_IDS.thermostatGym, label: 'Thermostat — Gym' },
  { id: DEVICE_IDS.thermostatBar, label: 'Thermostat — Bar' },
  { id: DEVICE_IDS.thermostatLaundry, label: 'Thermostat — Laundry' },
];
