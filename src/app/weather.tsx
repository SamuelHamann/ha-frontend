import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ConnectionNotice } from '@/components/connection-notice';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { STAT_ICONS, conditionIcon, conditionLabel } from '@/constants/weather-icons';
import { useHomeAssistantContext } from '@/providers/home-assistant-provider';
import { useWeather, type CurrentWeather, type ForecastEntry } from '@/hooks/use-weather';
import { useTheme } from '@/hooks/use-theme';

const HOURLY_COUNT = 12;

function round(n?: number, digits = 0) {
  if (n === undefined || n === null) return '—';
  return n.toFixed(digits);
}

function hourLabel(datetime: string) {
  return new Date(datetime).toLocaleTimeString([], { hour: 'numeric', hour12: false }) + 'h';
}

function dayLabel(datetime: string, index: number) {
  if (index === 0) return 'Today';
  return new Date(datetime).toLocaleDateString([], { weekday: 'short' });
}

function Stat({
  icon,
  label,
  value,
}: {
  icon: SymbolViewProps['name'];
  label: string;
  value: string;
}) {
  const theme = useTheme();
  return (
    <ThemedView type="backgroundElement" style={styles.stat}>
      <SymbolView name={icon} tintColor={theme.textSecondary} size={20} />
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      <ThemedText type="smallBold">{value}</ThemedText>
    </ThemedView>
  );
}

function CurrentConditions({ current }: { current: CurrentWeather }) {
  const theme = useTheme();
  const a = current.attributes ?? {};

  const tempUnit = a.temperature_unit ?? '°C';
  const windUnit = a.wind_speed_unit ?? 'km/h';
  const pressureUnit = a.pressure_unit ?? 'hPa';

  return (
    <View style={styles.section}>
      <View style={styles.currentRow}>
        <SymbolView name={conditionIcon(current.condition)} tintColor={theme.text} size={64} />
        <View>
          <ThemedText type="title" style={styles.currentTemp}>
            {round(a.temperature, 1)}
            {tempUnit}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {conditionLabel(current.condition)}
          </ThemedText>
        </View>
      </View>

      <View style={styles.statGrid}>
        <Stat icon={STAT_ICONS.uv} label="UV index" value={round(a.uv_index, 1)} />
        <Stat
          icon={STAT_ICONS.wind}
          label="Wind"
          value={`${round(a.wind_speed, 1)} ${windUnit}`}
        />
        <Stat icon={STAT_ICONS.humidity} label="Humidity" value={`${round(a.humidity)}%`} />
        <Stat
          icon={STAT_ICONS.pressure}
          label="Pressure"
          value={`${round(a.pressure, 1)} ${pressureUnit}`}
        />
        <Stat
          icon={STAT_ICONS.dewPoint}
          label="Dew point"
          value={`${round(a.dew_point, 1)}${tempUnit}`}
        />
        <Stat icon={STAT_ICONS.cloud} label="Cloud cover" value={`${round(a.cloud_coverage)}%`} />
      </View>
    </View>
  );
}

function HourlyForecast({ hourly }: { hourly: ForecastEntry[] }) {
  const theme = useTheme();
  const next12 = hourly.slice(0, HOURLY_COUNT);

  return (
    <View style={styles.section}>
      <ThemedText type="small" themeColor="textSecondary" style={styles.sectionLabel}>
        Next {HOURLY_COUNT} hours
      </ThemedText>
      {next12.length === 0 ? (
        <ThemedText type="small" themeColor="textSecondary">
          Waiting for forecast…
        </ThemedText>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.hourlyRow}>
            {next12.map((h) => (
              <ThemedView key={h.datetime} type="backgroundElement" style={styles.hourCard}>
                <ThemedText type="small" themeColor="textSecondary">
                  {hourLabel(h.datetime)}
                </ThemedText>
                <SymbolView name={conditionIcon(h.condition)} tintColor={theme.text} size={26} />
                <ThemedText type="smallBold">{round(h.temperature, 1)}°</ThemedText>
                <ThemedText type="code" themeColor="textSecondary">
                  {round(h.precipitation, 1)}mm
                </ThemedText>
              </ThemedView>
            ))}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

function DailyForecast({ daily }: { daily: ForecastEntry[] }) {
  const theme = useTheme();

  return (
    <View style={styles.section}>
      <ThemedText type="small" themeColor="textSecondary" style={styles.sectionLabel}>
        Daily
      </ThemedText>
      {daily.length === 0 ? (
        <ThemedText type="small" themeColor="textSecondary">
          Waiting for forecast…
        </ThemedText>
      ) : (
        daily.map((d, i) => (
          <ThemedView key={d.datetime} type="backgroundElement" style={styles.dayRow}>
            <ThemedText type="smallBold" style={styles.dayName}>
              {dayLabel(d.datetime, i)}
            </ThemedText>
            <SymbolView name={conditionIcon(d.condition)} tintColor={theme.text} size={24} />
            <ThemedText type="small" themeColor="textSecondary" style={styles.dayCondition}>
              {conditionLabel(d.condition)}
            </ThemedText>
            <ThemedText type="code" themeColor="textSecondary" style={styles.dayPrecip}>
              {round(d.precipitation, 1)}mm
            </ThemedText>
            <ThemedText type="smallBold" style={styles.dayTemp}>
              {round(d.temperature, 0)}° / {round(d.templow, 0)}°
            </ThemedText>
          </ThemedView>
        ))
      )}
    </View>
  );
}

export default function WeatherScreen() {
  const { status, error } = useHomeAssistantContext();
  const { current, hourly, daily, entityId } = useWeather();

  if (!entityId) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea} edges={['bottom', 'left', 'right']}>
          <ThemedText type="subtitle">Weather</ThemedText>
          {status === 'connected' ? (
            <ThemedText type="small" themeColor="textSecondary">
              No weather entity found on the configured forecast device.
            </ThemedText>
          ) : (
            <ConnectionNotice status={status} error={error} />
          )}
        </SafeAreaView>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['bottom', 'left', 'right']}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {current && <CurrentConditions current={current} />}
          <HourlyForecast hourly={hourly} />
          <DailyForecast daily={daily} />
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    paddingHorizontal: Spacing.four,
    gap: Spacing.one,
  },
  scrollContent: {
    gap: Spacing.four,
    paddingBottom: Spacing.five,
  },
  section: {
    gap: Spacing.two,
  },
  sectionLabel: {
    textTransform: 'uppercase',
  },
  currentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.four,
  },
  currentTemp: {
    fontSize: 44,
    lineHeight: 48,
  },
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  stat: {
    flexGrow: 1,
    flexBasis: 140,
    borderRadius: Spacing.two,
    padding: Spacing.three,
    gap: Spacing.half,
  },
  hourlyRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  hourCard: {
    width: 76,
    borderRadius: Spacing.two,
    paddingVertical: Spacing.three,
    alignItems: 'center',
    gap: Spacing.half,
  },
  dayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderRadius: Spacing.two,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  dayName: {
    width: 56,
  },
  dayCondition: {
    flex: 1,
  },
  dayPrecip: {
    width: 60,
    textAlign: 'right',
  },
  dayTemp: {
    width: 84,
    textAlign: 'right',
  },
});
