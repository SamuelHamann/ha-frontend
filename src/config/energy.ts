/**
 * Settings behind the Energy page. Not secret, so git-tracked.
 *
 * Each metered device pairs a watched device — whose `power` sensor gives the live draw —
 * with the recorder statistic that holds its consumption. The two are listed separately
 * because Hilo creates its per-room energy counters with `device_id: null`, so they can't be
 * resolved from the device the way the power sensor can (see `ENERGY_TODAY_ENTITY_IDS` in
 * `@/config/home` for the same quirk on the house total).
 */
import { DEVICE_IDS } from '@/config/devices';

export interface MeteredDevice {
  /** Fixed display name, not HA's area or entity name. */
  name: string;
  deviceId: string;
  /**
   * The `total_increasing` kWh counter whose `change` per period is the consumption. When
   * absent, the device's own `energy` sensor is used; failing that, the hourly mean of its
   * power sensor stands in.
   */
  energyEntityId?: string;
}

/** Thermostats, in the same room order as the Home page. */
export const METERED_THERMOSTATS: MeteredDevice[] = [
  {
    name: 'Living Room',
    deviceId: DEVICE_IDS.thermostatLivingRoom,
    energyEntityId: 'sensor.living_room_salon_hilo_energy',
  },
  {
    name: 'Kitchen',
    deviceId: DEVICE_IDS.thermostatKitchen,
    energyEntityId: 'sensor.kitchen_cuisine_hilo_energy',
  },
  {
    name: 'Bedroom',
    deviceId: DEVICE_IDS.thermostatBedroom,
    energyEntityId: 'sensor.bedroom_chambre_hilo_energy',
  },
  {
    name: 'Office',
    deviceId: DEVICE_IDS.thermostatOffice,
    energyEntityId: 'sensor.office_bureau_hilo_energy',
  },
  { name: 'Gym', deviceId: DEVICE_IDS.thermostatGym, energyEntityId: 'sensor.gym_gym_hilo_energy' },
  { name: 'Bar', deviceId: DEVICE_IDS.thermostatBar, energyEntityId: 'sensor.bar_bar_hilo_energy' },
  {
    name: 'Laundry',
    deviceId: DEVICE_IDS.thermostatLaundry,
    energyEntityId: 'sensor.laundry_room_lavage_hilo_energy',
  },
];

/**
 * Everything else that reports its own draw — mostly metering plugs. The pool plug is not
 * here: it switches but carries no power sensor.
 */
export const METERED_DEVICES: MeteredDevice[] = [
  {
    name: 'Water heater',
    deviceId: DEVICE_IDS.waterHeater,
    energyEntityId: 'sensor.laundry_room_water_heater_hilo_energy',
  },
  { name: 'Office desk', deviceId: DEVICE_IDS.outletOfficeDesk },
  { name: 'Dining tablet', deviceId: DEVICE_IDS.outletDiningTablet },
];

/**
 * How the house total is split on the Energy page's chart, in stack order from the bottom.
 * Whatever these don't account for is drawn as a remainder slice.
 */
export const ENERGY_CATEGORIES: { name: string; devices: MeteredDevice[] }[] = [
  { name: 'Heating', devices: METERED_THERMOSTATS },
  { name: 'Water heater', devices: METERED_DEVICES.filter((d) => d.deviceId === DEVICE_IDS.waterHeater) },
  {
    name: 'Connected devices',
    devices: METERED_DEVICES.filter((d) => d.deviceId !== DEVICE_IDS.waterHeater),
  },
];
export const ENERGY_REMAINDER_NAME = 'Others';

/** How often the charts re-read the recorder — a wall tablet sits on this page for days. */
export const ENERGY_REFRESH_MS = 5 * 60 * 1000;

/** How far back the two scales fetch: a full day of hours (today is drawn from midnight). */
export const ENERGY_HOURLY_HOURS = 24;
export const ENERGY_DAILY_DAYS = 7;

/** The whole-house energy total, behind the Home page's power modal and the Energy page. */
export const ENERGY_TOTAL_STATISTIC_ID = 'sensor.hilo_energy_total';

/**
 * Hilo's running cost for the day, in CAD, resetting at midnight — so each day's closing
 * value is that day's bill. Listed under both ids the entity can carry: the integration
 * expects `sensor.hilo_cost_total` and mis-tiers everything until it is renamed to that;
 * whichever has statistics is used.
 */
export const ENERGY_COST_STATISTIC_IDS = [
  'sensor.hilo_cost_total',
  'sensor.office_hilo_gateway_hilo_cost_total',
];
export const ENERGY_CURRENCY = '$';
