/**
 * Settings behind the Home page. Not secret, so git-tracked.
 *
 * The hardware itself lives in `@/config/devices` as device ids; this file only says how the
 * Home page arranges and labels it.
 */
import type { SymbolViewProps } from 'expo-symbols';

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

export interface RoomLight {
  deviceId: string;
  /**
   * Which switch on the device is the room's main light, for multi-gang wall switches.
   * Gangs are ordered by entity id, so 0 is the first switch and 1 the second.
   */
  gang: number;
}

/** One device row inside a room's modal. */
export type RoomControl =
  /** A gang of a wall switch. `readOnly` renders the state but refuses to change it. */
  | { kind: 'switch'; label: string; deviceId: string; gang: number; readOnly?: boolean }
  | { kind: 'outlet'; label: string; deviceId: string; gang?: number }
  /** A colour bulb: on/off, intensity, colour temperature and preset colours. */
  | { kind: 'bulb'; label: string; deviceId: string }
  | { kind: 'thermostat'; label: string; deviceId: string }
  | { kind: 'poolPump'; label: string }
  /** Bar chart of a sensor's recent history. */
  | { kind: 'history'; label: string; deviceId: string; deviceClass: string; hours: number };

export interface Room {
  name: string;
  icon: SymbolViewProps['name'];
  /** Absent when the room has no controllable light — the card shows a dead button. */
  light?: RoomLight;
  /** Occupancy sensor device. Absent when the room has none — no icon is shown at all. */
  presenceDeviceId?: string;
  /** Devices listed in the room's modal. Empty means a placeholder modal. */
  controls: RoomControl[];
}

/**
 * The room cards in the centre of the Home page, two per row in this order.
 *
 * Rooms without a `light` render a placeholder button; nothing on this instance controls the
 * Kitchen or Stairs lights yet.
 */
export const ROOMS: Room[] = [
  {
    name: 'Living Room',
    icon: { ios: 'sofa.fill', android: 'weekend', web: 'weekend' },
    light: { deviceId: DEVICE_IDS.lightLivingRoom, gang: 0 },
    controls: [
      { kind: 'bulb', label: 'Bubble light', deviceId: DEVICE_IDS.lightLivingRoom },
      { kind: 'thermostat', label: 'Thermostat', deviceId: DEVICE_IDS.thermostatLivingRoom },
    ],
  },
  {
    name: 'Kitchen',
    icon: { ios: 'refrigerator.fill', android: 'kitchen', web: 'kitchen' },
    controls: [{ kind: 'thermostat', label: 'Thermostat', deviceId: DEVICE_IDS.thermostatKitchen }],
  },
  {
    name: 'Bedroom',
    icon: { ios: 'bed.double.fill', android: 'bed', web: 'bed' },
    // The main light is the second gang of the wall switch.
    light: { deviceId: DEVICE_IDS.lightBedroom, gang: 1 },
    controls: [
      // The first gang feeds the bedside lamps, so it has to stay on.
      {
        kind: 'switch',
        label: 'Main power',
        deviceId: DEVICE_IDS.lightBedroom,
        gang: 0,
        readOnly: true,
      },
      { kind: 'switch', label: 'Light fixture', deviceId: DEVICE_IDS.lightBedroom, gang: 1 },
      { kind: 'bulb', label: 'Bedside left', deviceId: DEVICE_IDS.bulbBedsideLeft },
      { kind: 'bulb', label: 'Bedside right', deviceId: DEVICE_IDS.bulbBedsideRight },
      { kind: 'thermostat', label: 'Thermostat', deviceId: DEVICE_IDS.thermostatBedroom },
    ],
  },
  {
    name: 'Office',
    icon: { ios: 'desktopcomputer', android: 'desk', web: 'desk' },
    light: { deviceId: DEVICE_IDS.lightOffice, gang: 0 },
    presenceDeviceId: DEVICE_IDS.presenceOffice,
    controls: [
      { kind: 'outlet', label: 'Wall outlet', deviceId: DEVICE_IDS.outletOfficeDesk },
      { kind: 'bulb', label: 'Mushroom lamp', deviceId: DEVICE_IDS.lightOffice },
      { kind: 'thermostat', label: 'Thermostat', deviceId: DEVICE_IDS.thermostatOffice },
    ],
  },
  {
    name: 'Gym',
    icon: { ios: 'dumbbell.fill', android: 'fitness_center', web: 'fitness_center' },
    light: { deviceId: DEVICE_IDS.lightGym, gang: 0 },
    presenceDeviceId: DEVICE_IDS.presenceGym,
    controls: [
      // The presence automation drives the left gang, so that is the main light.
      { kind: 'switch', label: 'Main light', deviceId: DEVICE_IDS.lightGym, gang: 0 },
      { kind: 'switch', label: 'Accent light', deviceId: DEVICE_IDS.lightGym, gang: 1 },
      { kind: 'thermostat', label: 'Thermostat', deviceId: DEVICE_IDS.thermostatGym },
    ],
  },
  {
    name: 'Basement',
    icon: { ios: 'wineglass.fill', android: 'wine_bar', web: 'wine_bar' },
    // The main light is the first gang of the wall switch.
    light: { deviceId: DEVICE_IDS.lightBasement, gang: 0 },
    presenceDeviceId: DEVICE_IDS.presenceBasement,
    controls: [
      { kind: 'switch', label: 'Main light', deviceId: DEVICE_IDS.lightBasement, gang: 0 },
      { kind: 'switch', label: 'Accent light', deviceId: DEVICE_IDS.lightBasement, gang: 1 },
      { kind: 'thermostat', label: 'Thermostat', deviceId: DEVICE_IDS.thermostatBar },
    ],
  },
  {
    name: 'Laundry',
    icon: { ios: 'washer.fill', android: 'local_laundry_service', web: 'local_laundry_service' },
    light: { deviceId: DEVICE_IDS.lightLaundry, gang: 0 },
    presenceDeviceId: DEVICE_IDS.presenceLaundry,
    controls: [
      { kind: 'switch', label: 'Main light', deviceId: DEVICE_IDS.lightLaundry, gang: 0 },
      { kind: 'thermostat', label: 'Thermostat', deviceId: DEVICE_IDS.thermostatLaundry },
    ],
  },
  {
    name: 'Stairs',
    icon: { ios: 'stairs', android: 'stairs', web: 'stairs' },
    controls: [],
  },
];

/** Rendered full width beneath the room grid. No outdoor light is wired up yet. */
export const OUTDOOR_ROOM: Room = {
  name: 'Outdoor',
  icon: { ios: 'tree.fill', android: 'park', web: 'park' },
  controls: [
    { kind: 'poolPump', label: 'Pool pump' },
    {
      kind: 'history',
      label: 'Garden humidity · 12h',
      deviceId: DEVICE_IDS.gardenSoilSensor,
      deviceClass: 'moisture',
      hours: 12,
    },
  ],
};

/** Statistic behind the 7-day chart in the power modal — the whole-house energy total. */
export const ENERGY_STATISTIC_ID = 'sensor.hilo_energy_total';
export const ENERGY_HISTORY_DAYS = 7;

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
