const httpUrl = (process.env.EXPO_PUBLIC_HA_URL ?? '').replace(/\/+$/, '');

export const HA_HTTP_URL = httpUrl;
export const HA_WS_URL = httpUrl
  ? `${httpUrl.replace(/^http/, 'ws')}/api/websocket`
  : '';
export const HA_TOKEN = process.env.EXPO_PUBLIC_HA_TOKEN ?? '';
