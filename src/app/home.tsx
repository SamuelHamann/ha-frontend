import { SymbolView } from 'expo-symbols';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ConnectionNotice } from '@/components/connection-notice';
import { Panel } from '@/components/panel';
import { FORECAST_SNAPSHOT_HOURS } from '@/config/home';
import { GlobalStyles, Palette, Spacing, Type } from '@/constants/styles';
import { conditionIcon, conditionLabel } from '@/constants/weather-icons';
import { usePower } from '@/hooks/use-power';
import { useWeather, type ForecastEntry } from '@/hooks/use-weather';
import { useHomeAssistantContext } from '@/providers/home-assistant-provider';

/** Repaint the clock on the minute boundary rather than on a free-running 60s timer. */
function useNow() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      const next = new Date();
      setNow(next);
      timer = setTimeout(tick, 60000 - (next.getSeconds() * 1000 + next.getMilliseconds()));
    };
    timer = setTimeout(tick, 60000 - (now.getSeconds() * 1000 + now.getMilliseconds()));
    return () => clearTimeout(timer);
    // Scheduling is self-perpetuating; re-running on every tick would stack timers.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return now;
}

interface Snapshot {
  hour: number;
  label: string;
  entry: ForecastEntry | null;
}

/**
 * The four times of day, resolved against the hourly forecast.
 *
 * HA's hourly forecast starts at the current hour, so today's earlier slots are simply gone.
 * Once every slot for today has passed the strip rolls to tomorrow, and the panel header
 * names the day being shown so it's never ambiguous.
 */
function useSnapshots(hourly: ForecastEntry[], now: Date) {
  return useMemo(() => {
    const byHour = new Map<string, ForecastEntry>();
    for (const entry of hourly) {
      const d = new Date(entry.datetime);
      if (Number.isNaN(d.getTime())) continue;
      byHour.set(`${d.toDateString()}|${d.getHours()}`, entry);
    }

    const build = (day: Date): Snapshot[] =>
      FORECAST_SNAPSHOT_HOURS.map((hour) => ({
        hour,
        label: new Date(day.getFullYear(), day.getMonth(), day.getDate(), hour)
          .toLocaleTimeString([], { hour: 'numeric' })
          .toUpperCase(),
        entry: byHour.get(`${day.toDateString()}|${hour}`) ?? null,
      }));

    const today = build(now);
    if (today.some((s) => s.entry)) return { day: now, snapshots: today };

    const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    return { day: tomorrow, snapshots: build(tomorrow) };
  }, [hourly, now]);
}

function round(n?: number | null, digits = 0) {
  if (n === undefined || n === null || Number.isNaN(n)) return '—';
  return n.toFixed(digits);
}

function ClockPanel({ now }: { now: Date }) {
  return (
    <Panel style={styles.clockPanel}>
      <Text style={Type.label}>LOCAL TIME</Text>
      <Text style={Type.display}>
        {now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
      </Text>
      <Text style={Type.body}>
        {now
          .toLocaleDateString([], {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })
          .toUpperCase()}
      </Text>
    </Panel>
  );
}

function SnapshotCell({ snapshot }: { snapshot: Snapshot }) {
  const entry = snapshot.entry;

  return (
    <View style={[GlobalStyles.tile, styles.snapshot]}>
      <Text style={Type.label}>{snapshot.label}</Text>
      <SymbolView
        name={conditionIcon(entry?.condition)}
        tintColor={entry ? Palette.text : Palette.border}
        size={26}
      />
      <Text style={[Type.monoBright, styles.snapshotTemp]}>
        {entry ? `${round(entry.temperature, 0)}°` : '—'}
      </Text>
      <View style={styles.rainRow}>
        <SymbolView
          name={{ ios: 'drop.fill', android: 'water_drop', web: 'water_drop' }}
          tintColor={entry?.precipitation ? Palette.secondary : Palette.textMuted}
          size={11}
        />
        <Text style={[Type.mono, !!entry?.precipitation && styles.rainWet]}>
          {entry ? `${round(entry.precipitation ?? 0, 1)} mm` : '—'}
        </Text>
      </View>
    </View>
  );
}

function WeatherPanel({ now }: { now: Date }) {
  const { current, hourly } = useWeather();
  const { day, snapshots } = useSnapshots(hourly, now);
  const attributes = current?.attributes ?? {};
  const isToday = day.toDateString() === now.toDateString();

  return (
    <Panel style={styles.weatherPanel}>
      <View style={GlobalStyles.spread}>
        <Text style={Type.label}>WEATHER</Text>
        <Text style={Type.label}>
          {isToday ? 'TODAY' : 'TOMORROW'} ·{' '}
          {day.toLocaleDateString([], { day: 'numeric', month: 'short' }).toUpperCase()}
        </Text>
      </View>

      <View style={styles.currentRow}>
        <SymbolView name={conditionIcon(current?.condition)} tintColor={Palette.primary} size={44} />
        <View style={styles.currentText}>
          <Text style={Type.readout}>
            {round(attributes.temperature, 1)}
            {attributes.temperature_unit ?? '°C'}
          </Text>
          <Text style={Type.mono}>{conditionLabel(current?.condition).toUpperCase()}</Text>
        </View>
      </View>

      <View style={styles.snapshotRow}>
        {snapshots.map((snapshot) => (
          <SnapshotCell key={snapshot.hour} snapshot={snapshot} />
        ))}
      </View>
    </Panel>
  );
}

function PowerPanel() {
  const { watts, unit, lastChanged, kwhToday } = usePower();

  return (
    <Panel style={styles.powerPanel}>
      <View style={GlobalStyles.spread}>
        <Text style={Type.label}>POWER</Text>
        {!!lastChanged && (
          <Text style={Type.label}>
            {new Date(lastChanged).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
              hour12: false,
            })}
          </Text>
        )}
      </View>

      <View style={styles.powerRow}>
        <SymbolView
          name={{ ios: 'bolt.fill', android: 'bolt', web: 'bolt' }}
          tintColor={Palette.warn}
          size={30}
        />
        <Text style={Type.readout}>
          {watts === null ? '—' : Math.round(watts).toLocaleString()}
        </Text>
        <Text style={Type.mono}>{unit}</Text>
      </View>

      <View style={GlobalStyles.divider}>
        <Text style={Type.label}>TODAY</Text>
        <View style={GlobalStyles.dividerRule} />
      </View>

      <View style={styles.powerRow}>
        <Text style={[Type.readout, styles.energyValue]}>
          {kwhToday === null ? '—' : kwhToday.toFixed(1)}
        </Text>
        <Text style={Type.mono}>kWh</Text>
      </View>
    </Panel>
  );
}

export default function HomeScreen() {
  const { status, error } = useHomeAssistantContext();
  const now = useNow();
  const connected = status === 'connected';

  return (
    <View style={GlobalStyles.screen}>
      <SafeAreaView style={GlobalStyles.content} edges={['bottom', 'left', 'right']}>
        <View style={styles.columns}>
          {/* Left third: clock, today's weather, live power — stacked. */}
          <View style={styles.sideColumn}>
            <ClockPanel now={now} />
            {connected ? (
              <>
                <WeatherPanel now={now} />
                <PowerPanel />
              </>
            ) : (
              <Panel style={styles.weatherPanel}>
                <Text style={Type.label}>HOME ASSISTANT</Text>
                <ConnectionNotice status={status} error={error} />
              </Panel>
            )}
          </View>

          {/* Reserved for the rest of the dashboard. */}
          <View style={styles.mainColumn} />
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  columns: {
    flex: 1,
    flexDirection: 'row',
    gap: Spacing.three,
  },
  /** One third of the content area; the remaining two thirds are intentionally blank. */
  sideColumn: {
    flex: 1,
    gap: Spacing.three,
  },
  mainColumn: {
    flex: 2,
  },
  clockPanel: {
    gap: Spacing.one,
  },
  weatherPanel: {
    flex: 1,
    justifyContent: 'space-between',
  },
  powerPanel: {
    gap: Spacing.two,
  },
  currentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  currentText: {
    gap: 2,
  },
  snapshotRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  snapshot: {
    flex: 1,
    alignItems: 'center',
    gap: Spacing.one,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.one,
  },
  snapshotTemp: {
    fontSize: 16,
  },
  rainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  rainWet: {
    color: Palette.secondary,
  },
  powerRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.two,
  },
  /** The day's total is a summary, not the live figure — same size, cooler colour. */
  energyValue: {
    color: Palette.secondary,
  },
});
