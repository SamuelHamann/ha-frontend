import type { SymbolViewProps } from 'expo-symbols';

type IconName = SymbolViewProps['name'];

/** HA weather condition strings -> platform symbols. */
const CONDITION_ICONS: Record<string, IconName> = {
  'clear-night': { ios: 'moon.stars', android: 'moon_stars', web: 'moon_stars' },
  cloudy: { ios: 'cloud', android: 'cloud', web: 'cloud' },
  exceptional: { ios: 'exclamationmark.triangle', android: 'warning', web: 'warning' },
  fog: { ios: 'cloud.fog', android: 'foggy', web: 'foggy' },
  hail: { ios: 'cloud.hail', android: 'weather_hail', web: 'weather_hail' },
  lightning: { ios: 'cloud.bolt', android: 'thunderstorm', web: 'thunderstorm' },
  'lightning-rainy': { ios: 'cloud.bolt.rain', android: 'thunderstorm', web: 'thunderstorm' },
  partlycloudy: { ios: 'cloud.sun', android: 'partly_cloudy_day', web: 'partly_cloudy_day' },
  pouring: { ios: 'cloud.heavyrain', android: 'rainy', web: 'rainy' },
  rainy: { ios: 'cloud.rain', android: 'rainy', web: 'rainy' },
  snowy: { ios: 'cloud.snow', android: 'weather_snowy', web: 'weather_snowy' },
  'snowy-rainy': { ios: 'cloud.sleet', android: 'weather_mix', web: 'weather_mix' },
  sunny: { ios: 'sun.max', android: 'sunny', web: 'sunny' },
  windy: { ios: 'wind', android: 'air', web: 'air' },
  'windy-variant': { ios: 'wind', android: 'air', web: 'air' },
};

const FALLBACK_ICON: IconName = { ios: 'cloud', android: 'cloud', web: 'cloud' };

export function conditionIcon(condition?: string | null): IconName {
  if (!condition) return FALLBACK_ICON;
  return CONDITION_ICONS[condition] ?? FALLBACK_ICON;
}

export function conditionLabel(condition?: string | null): string {
  if (!condition) return '—';
  return condition.replace(/-/g, ' ').replace(/^./, (c) => c.toUpperCase());
}

export const STAT_ICONS = {
  temperature: { ios: 'thermometer', android: 'thermometer', web: 'thermometer' },
  humidity: { ios: 'humidity', android: 'humidity_percentage', web: 'humidity_percentage' },
  wind: { ios: 'wind', android: 'air', web: 'air' },
  uv: { ios: 'sun.max', android: 'sunny', web: 'sunny' },
  pressure: { ios: 'gauge', android: 'compress', web: 'compress' },
  precipitation: { ios: 'drop', android: 'water_drop', web: 'water_drop' },
  cloud: { ios: 'cloud', android: 'cloud', web: 'cloud' },
  dewPoint: { ios: 'drop', android: 'water_drop', web: 'water_drop' },
} satisfies Record<string, IconName>;
