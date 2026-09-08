/**
 * Settings behind the Home page. Not secret, so git-tracked.
 *
 * The hardware itself lives in `@/config/devices` as device ids; this file only says how the
 * Home page arranges and labels it.
 */
import { DEVICE_IDS } from '@/config/devices';

/**
 * Today's energy use, in kWh. Hilo's daily `utility_meter` splits the house total across
 * three tariff buckets — only one collects at a time — so today's consumption is their sum.
 * All three reset at local midnight.
 *
 * These are listed as entity ids rather than a device id, unlike the power meter in
 * `DEVICE_IDS.powerMeter`: the integration creates them with `device_id: null`, so there is
 * no device to resolve them from.
 */
export const ENERGY_TODAY_ENTITY_IDS = [
  'sensor.hilo_energy_total_high',
  'sensor.hilo_energy_total_medium',
  'sensor.hilo_energy_total_low',
];

/**
 * Home Assistant's own clock, from the `time_date` integration ("Date & Time").
 *
 * Which of these exist depends on the display options ticked when the integration was added,
 * so the page takes the best available and says which it used:
 *   - `sensor.date_time_iso` is a true instant, offset included — the ideal source.
 *   - `sensor.date_time` / `sensor.date` + `sensor.time` are the home's wall clock.
 *   - `sensor.time` alone gives the time only; the date then comes from the device.
 *
 * Tick "Date" (or "Date & time (ISO)") in the integration's options to make the date
 * server-sourced too.
 */
export const HA_TIME_ENTITY_IDS = {
  iso: 'sensor.date_time_iso',
  dateTime: 'sensor.date_time',
  date: 'sensor.date',
  time: 'sensor.time',
} as const;

/**
 * Stand-in readings for the A/C card.
 *
 * The unit is not connected to Home Assistant yet, so the card renders these and marks
 * itself as a placeholder rather than pretending to be live. When it is wired up, add its
 * device id to `@/config/devices` and replace this with a hook, as the thermostats do.
 */
export const AC_PLACEHOLDER = {
  /** Drives the glow and the spinning fan. Flip to false to see the idle card. */
  on: true,
  fan: 'Auto',
  setpoint: 22,
};

/**
 * The thermostat cards on the Home page, top to bottom.
 *
 * Names and order are fixed here rather than read from HA's area registry, so the list reads
 * the same way every time regardless of what the areas are called upstream.
 */
export const THERMOSTATS = [
  { name: 'Living Room', deviceId: DEVICE_IDS.thermostatLivingRoom },
  { name: 'Kitchen', deviceId: DEVICE_IDS.thermostatKitchen },
  { name: 'Bedroom', deviceId: DEVICE_IDS.thermostatBedroom },
  { name: 'Office', deviceId: DEVICE_IDS.thermostatOffice },
  { name: 'Gym', deviceId: DEVICE_IDS.thermostatGym },
  { name: 'Bar', deviceId: DEVICE_IDS.thermostatBar },
  { name: 'Laundry', deviceId: DEVICE_IDS.thermostatLaundry },
];

/**
 * Which outlet of the pool plug drives the pump.
 *
 * `DEVICE_IDS.poolPlug` is a two-outlet TP-Link plug, so the device id alone is ambiguous —
 * both `switch.…_switch_1` and `…_switch_2` hang off it. Outlet 1 is the pump.
 */
export const POOL_PUMP_SWITCH_SUFFIX = '_switch_1';

/** Hours of the day the forecast strip snapshots: 8 AM, noon, 4 PM and 8 PM. */
export const FORECAST_SNAPSHOT_HOURS = [8, 12, 16, 20];

/**
 * Spacing between snapshots, in hours.
 *
 * Today's strip drops each slot as it passes and continues this cadence past the last one
 * into the following night, so the card always shows four upcoming times rather than
 * em dashes: after 8 AM it reads noon / 4 PM / 8 PM / midnight.
 */
export const FORECAST_SNAPSHOT_STEP_HOURS = 4;
