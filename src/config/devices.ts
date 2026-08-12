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

export const WATCHED_DEVICES: WatchedDevice[] = [{ id: '43774a897b41752d4c35453e07e3f68c' }];
