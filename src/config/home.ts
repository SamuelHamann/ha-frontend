/**
 * Settings behind the Home page. Not secret, so git-tracked.
 *
 * The power meter itself is a watched device — see `DEVICE_IDS.powerMeter` in
 * `@/config/devices`, which is where hardware belongs.
 */

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

/** Hours of the day the forecast strip snapshots: 8 AM, noon, 4 PM and 8 PM. */
export const FORECAST_SNAPSHOT_HOURS = [8, 12, 16, 20];
