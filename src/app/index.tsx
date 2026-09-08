import { SymbolView } from 'expo-symbols';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ConnectionNotice } from '@/components/connection-notice';
import { Panel } from '@/components/panel';
import { PowerModal } from '@/components/power-modal';
import { PulseGlow } from '@/components/pulse-glow';
import { RoomCard } from '@/components/room-card';
import { RoomModal } from '@/components/room-modal';
import { Spin } from '@/components/spin';
import { Wave } from '@/components/wave';
import { ThermostatCard } from '@/components/thermostat-card';
import {
  AC_PLACEHOLDER,
  FORECAST_SNAPSHOT_HOURS,
  FORECAST_SNAPSHOT_STEP_HOURS,
  OUTDOOR_ROOM,
  ROOMS,
  type Room,
} from '@/config/home';
import { SWIPE_DISTANCE, SWIPE_SLOP, SWIPE_VELOCITY } from '@/constants/gestures';
import { GlobalStyles, Palette, Spacing, Type } from '@/constants/styles';
import { conditionIcon, conditionLabel } from '@/constants/weather-icons';
import { useHaTime, type ClockSource, type HaClock } from '@/hooks/use-ha-time';
import { usePool, type PumpStatus } from '@/hooks/use-pool';
import { useRoomLights, type RoomLightState } from '@/hooks/use-room-lights';
import { useRoomPresence } from '@/hooks/use-room-presence';
import { usePower } from '@/hooks/use-power';
import { useThermostats } from '@/hooks/use-thermostats';
import { useWeather, type ForecastEntry } from '@/hooks/use-weather';
import { useHomeAssistantContext } from '@/providers/home-assistant-provider';

interface Snapshot {
  key: string;
  label: string;
  entry: ForecastEntry | null;
}

/** A time to snapshot: an hour, plus how many days past the card's day it falls on. */
interface Slot {
  hour: number;
  dayOffset: number;
}

/**
 * The times today's strip shows.
 *
 * Slots that have already passed are dropped — their forecast is gone from HA's hourly feed
 * anyway — and the cadence continues past the last base hour into the night to keep four
 * cells filled. So after 8 AM the strip ends on midnight.
 */
function todaySlots(now: Date): Slot[] {
  const slots: Slot[] = FORECAST_SNAPSHOT_HOURS.filter((hour) => hour > now.getHours()).map(
    (hour) => ({ hour, dayOffset: 0 }),
  );

  let hour = FORECAST_SNAPSHOT_HOURS[FORECAST_SNAPSHOT_HOURS.length - 1];
  let dayOffset = 0;
  while (slots.length < FORECAST_SNAPSHOT_HOURS.length) {
    hour += FORECAST_SNAPSHOT_STEP_HOURS;
    if (hour >= 24) {
      hour -= 24;
      dayOffset += 1;
    }
    slots.push({ hour, dayOffset });
  }
  return slots;
}

interface ForecastDay {
  date: Date;
  snapshots: Snapshot[];
  /** The daily forecast for this date, when the daily feed reaches that far. */
  daily: ForecastEntry | null;
}

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function daysBetween(from: Date, to: Date) {
  return Math.round((startOfDay(to).getTime() - startOfDay(from).getTime()) / 86400000);
}

/**
 * One entry per day the hourly forecast reaches, starting today, each with its four
 * snapshots resolved.
 *
 * HA's hourly forecast starts at the current hour, so today's earlier slots are simply gone
 * and come back as null — the card renders those as em dashes rather than pretending.
 */
function useForecastDays(
  hourly: ForecastEntry[],
  daily: ForecastEntry[],
  now: Date,
): ForecastDay[] {
  return useMemo(() => {
    const byHour = new Map<string, ForecastEntry>();
    let lastDay = now;
    for (const entry of hourly) {
      const d = new Date(entry.datetime);
      if (Number.isNaN(d.getTime())) continue;
      byHour.set(`${d.toDateString()}|${d.getHours()}`, entry);
      if (d > lastDay) lastDay = d;
    }

    const byDay = new Map<string, ForecastEntry>();
    for (const entry of daily) {
      const d = new Date(entry.datetime);
      if (!Number.isNaN(d.getTime())) byDay.set(d.toDateString(), entry);
    }

    const count = Math.max(1, daysBetween(now, lastDay) + 1);
    return Array.from({ length: count }, (_, offset) => {
      const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
      // Only today rolls; the other days keep the plain schedule.
      const slots: Slot[] =
        offset === 0
          ? todaySlots(now)
          : FORECAST_SNAPSHOT_HOURS.map((hour) => ({ hour, dayOffset: 0 }));

      return {
        date,
        daily: byDay.get(date.toDateString()) ?? null,
        snapshots: slots.map(({ hour, dayOffset }) => {
          const at = new Date(
            date.getFullYear(),
            date.getMonth(),
            date.getDate() + dayOffset,
            hour,
          );
          return {
            key: `${dayOffset}-${hour}`,
            label: at.toLocaleTimeString([], { hour: 'numeric' }).toUpperCase(),
            entry: byHour.get(`${at.toDateString()}|${hour}`) ?? null,
          };
        }),
      };
    });
  }, [hourly, daily, now]);
}

function dayLabel(offset: number, date: Date) {
  if (offset === 0) return 'TODAY';
  if (offset === 1) return 'TOMORROW';
  return date
    .toLocaleDateString([], {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    })
    .toUpperCase();
}

function round(n?: number | null, digits = 0) {
  if (n === undefined || n === null || Number.isNaN(n)) return '—';
  return n.toFixed(digits);
}

const CLOCK_SOURCE_LABEL: Record<ClockSource, string> = {
  ha: 'HOME ASSISTANT',
  'ha-time': 'HA TIME · DEVICE DATE',
  device: 'DEVICE CLOCK',
};

function ClockPanel({ clock }: { clock: HaClock }) {
  return (
    <Panel style={styles.clockPanel}>
      <View style={GlobalStyles.spread}>
        <Text style={Type.label}>LOCAL TIME</Text>
        {/* Says which clock is actually driving the panel, so a fallback isn't silent. */}
        <Text style={Type.label}>{CLOCK_SOURCE_LABEL[clock.source]}</Text>
      </View>
      <Text style={Type.display}>
        {clock.format({ hour: '2-digit', minute: '2-digit', hour12: false })}
      </Text>
      <Text style={Type.body}>
        {clock
          .format({
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

/** The right-hand column's cards all share one width so they stack as a single stripe. */
const SIDE_CARD_WIDTH = 260;

/** How far the card follows the finger, and how far new content slides in from. */
const DRAG_FOLLOW = 0.4;
const DRAG_LIMIT = 56;
const ENTER_OFFSET = 44;

function WeatherPanel({ now }: { now: Date }) {
  const { current, hourly, daily } = useWeather();
  const days = useForecastDays(hourly, daily, now);

  // The card always opens on today; a swipe pages away from it. Today's strip rolls its
  // slots forward as they pass, so opening here is always useful.
  const [pinned, setPinned] = useState(0);
  const index = Math.min(pinned, days.length - 1);
  const day = days[index];

  const page = useCallback(
    (delta: number) => setPinned(Math.min(Math.max(index + delta, 0), days.length - 1)),
    [index, days.length],
  );

  // Two independent values so the gesture and the day-change animation never fight over one:
  // `drag` follows the finger, `enter` plays when the content is swapped.
  const drag = useSharedValue(0);
  const enter = useSharedValue(0);
  const fade = useSharedValue(1);
  const previousIndex = useRef(index);

  useEffect(() => {
    const direction = index - previousIndex.current;
    previousIndex.current = index;
    if (direction === 0) return;
    // Coming from the right when moving forward in time, and vice versa.
    enter.value = direction > 0 ? ENTER_OFFSET : -ENTER_OFFSET;
    enter.value = withTiming(0, {
      duration: 260,
      easing: Easing.out(Easing.cubic),
    });
    fade.value = 0.15;
    fade.value = withTiming(1, { duration: 260 });
  }, [index, enter, fade]);

  const contentStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: drag.value + enter.value }],
    opacity: fade.value,
  }));

  const swipe = useMemo(
    () =>
      Gesture.Pan()
        // Only take over once the drag is clearly horizontal, so a vertical one still belongs
        // to whatever is scrolling.
        .activeOffsetX([-SWIPE_SLOP, SWIPE_SLOP])
        .failOffsetY([-SWIPE_SLOP, SWIPE_SLOP])
        // These stay worklets on the UI thread so the drag tracks at frame rate; only the
        // state change hops to JS.
        .onUpdate((e) => {
          // Rubber-banded: the card acknowledges the drag without leaving its panel.
          const pull = e.translationX * DRAG_FOLLOW;
          drag.value = Math.max(-DRAG_LIMIT, Math.min(DRAG_LIMIT, pull));
        })
        .onEnd((e) => {
          drag.value = withSpring(0, { damping: 18, stiffness: 180 });
          const farEnough = Math.abs(e.translationX) > SWIPE_DISTANCE;
          const fastEnough = Math.abs(e.velocityX) > SWIPE_VELOCITY;
          if (!farEnough && !fastEnough) return;
          // Dragging left pulls the next day in from the right.
          runOnJS(page)(e.translationX < 0 ? 1 : -1);
        }),
    // `drag` is a Reanimated shared value: a stable ref, so it is not a dependency — and
    // listing it would trip the "value passed to a hook cannot be modified" rule.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [page],
  );

  const attributes = current?.attributes ?? {};

  return (
    <GestureDetector gesture={swipe}>
      <Panel style={styles.weatherPanel}>
        <Animated.View style={[styles.weatherBody, contentStyle]}>
          <View style={GlobalStyles.spread}>
            <Text style={Type.label}>WEATHER</Text>
            <View style={styles.dayNav}>
              {index !== 0 && (
                <Pressable
                  onPress={() => setPinned(0)}
                  accessibilityRole="button"
                  accessibilityLabel="Back to today"
                  hitSlop={8}
                  style={({ pressed }) => [
                    GlobalStyles.chip,
                    GlobalStyles.chipActive,
                    pressed && GlobalStyles.pressed,
                  ]}
                >
                  <Text style={[Type.label, styles.todayChip]}>TODAY</Text>
                </Pressable>
              )}
              <Text style={Type.label}>{dayLabel(index, day.date)}</Text>
            </View>
          </View>

          {index === 0 ? (
            <View style={styles.currentRow}>
              <SymbolView
                name={conditionIcon(current?.condition)}
                tintColor={Palette.primary}
                size={44}
              />
              <View style={styles.currentText}>
                <Text style={Type.readout}>
                  {round(attributes.temperature, 1)}
                  {attributes.temperature_unit ?? '°C'}
                </Text>
                <Text style={Type.mono}>{conditionLabel(current?.condition).toUpperCase()}</Text>
              </View>
            </View>
          ) : (
            <View style={styles.currentRow}>
              <SymbolView
                name={conditionIcon(day.daily?.condition)}
                tintColor={Palette.primary}
                size={44}
              />
              <View style={styles.currentText}>
                <Text style={Type.readout}>
                  {round(day.daily?.temperature, 0)}°
                  <Text style={Type.mono}> / {round(day.daily?.templow, 0)}°</Text>
                </Text>
                <Text style={Type.mono}>{conditionLabel(day.daily?.condition).toUpperCase()}</Text>
              </View>
            </View>
          )}

          <View style={styles.snapshotRow}>
            {day.snapshots.map((snapshot) => (
              <SnapshotCell key={snapshot.key} snapshot={snapshot} />
            ))}
          </View>
        </Animated.View>

        {/* Page indicator — stays put as an anchor while the content slides. */}
        <View style={styles.pageDots}>
          {days.map((d, i) => (
            <View
              key={d.date.toDateString()}
              style={[styles.pageDot, i === index && styles.pageDotOn]}
            />
          ))}
        </View>
      </Panel>
    </GestureDetector>
  );
}

function PowerPanel({ clock }: { clock: HaClock }) {
  const { watts, unit, lastChanged, kwhToday } = usePower();
  const [open, setOpen] = useState(false);

  return (
    <Panel style={styles.powerPanel}>
      <PowerModal visible={open} onClose={() => setOpen(false)} />
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

      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel="Power history"
        style={({ pressed }) => [styles.powerBody, pressed && GlobalStyles.pressed]}
      >
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
      </Pressable>
    </Panel>
  );
}

const PUMP_LABEL: Record<PumpStatus, string> = {
  running: 'RUNNING',
  off: 'OFF',
  unknown: 'UNAVAILABLE',
};

function PoolPanel() {
  const { status, temperature, temperatureUnit, pumpEntityId, togglePump } = usePool();
  const running = status === 'running';
  const [pending, setPending] = useState(false);

  const press = async () => {
    if (pending || !pumpEntityId) return;
    setPending(true);
    try {
      await togglePump();
    } catch {
      // The card reflects entity state, so a failure leaves it where it was.
    } finally {
      setPending(false);
    }
  };

  const pumpIcon = (
    <SymbolView
      name={{ ios: 'fan.fill', android: 'mode_fan', web: 'mode_fan' }}
      tintColor={running ? Palette.primary : Palette.textMuted}
      size={18}
    />
  );

  return (
    <Panel style={styles.poolPanel}>
      {/* Rendered first so the water sits behind the readings; flat while the pump is off. */}
      <Wave color={Palette.secondary} still={!running} />

      {/* Tapping the card starts or stops the pump. */}
      <Pressable
        onPress={press}
        disabled={pending || !pumpEntityId}
        accessibilityRole="switch"
        accessibilityState={{ checked: running, disabled: !pumpEntityId }}
        accessibilityLabel="Pool pump"
        style={({ pressed }) => [styles.poolBody, pressed && GlobalStyles.pressed]}
      >
        <Text style={Type.label}>POOL</Text>

        <View style={GlobalStyles.spread}>
          <View style={styles.poolRow}>
            {running ? <Spin>{pumpIcon}</Spin> : pumpIcon}
            <Text style={Type.mono}>PUMP</Text>
          </View>
          <View style={styles.poolRow}>
            {pending ? (
              <ActivityIndicator size="small" color={Palette.textMuted} />
            ) : (
              <View
                style={[
                  GlobalStyles.led,
                  running && styles.ledOn,
                  status === 'unknown' && styles.ledWarn,
                ]}
              />
            )}
            <Text style={[Type.monoBright, status === 'unknown' && styles.warnText]}>
              {PUMP_LABEL[status]}
            </Text>
          </View>
        </View>

        <View style={GlobalStyles.spread}>
          <View style={styles.poolRow}>
            <SymbolView
              name={{
                ios: 'thermometer.medium',
                android: 'thermostat',
                web: 'thermostat',
              }}
              tintColor={Palette.secondary}
              size={18}
            />
            <Text style={Type.mono}>WATER</Text>
          </View>
          <Text style={[Type.readout, styles.poolTemp]}>
            {temperature === null ? '—' : `${temperature.toFixed(1)}${temperatureUnit}`}
          </Text>
        </View>
      </Pressable>
    </Panel>
  );
}

function ThermostatsPanel() {
  const thermostats = useThermostats();
  const heating = thermostats.filter((t) => t.heating).length;

  return (
    <Panel style={styles.thermostatPanel}>
      <View style={GlobalStyles.spread}>
        <Text style={Type.label}>THERMOSTATS</Text>
        <Text style={[Type.label, heating > 0 && styles.heatingLabel]}>
          {heating > 0 ? `${heating} HEATING` : 'ALL IDLE'}
        </Text>
      </View>

      <View style={styles.thermostatStack}>
        {thermostats.map((thermostat) => (
          <ThermostatCard key={thermostat.name} thermostat={thermostat} />
        ))}
      </View>
    </Panel>
  );
}

/**
 * The A/C is not on Home Assistant yet, so this renders fixed values from the config and
 * says so plainly — a wall panel should never show invented numbers as if they were live.
 */
function AcPanel() {
  const { on, fan, setpoint } = AC_PLACEHOLDER;
  const accent = on ? Palette.secondary : Palette.textMuted;

  return (
    <Panel style={styles.acPanel}>
      {/* Rendered first so the wash sits behind the rows. */}
      {on && <PulseGlow color={Palette.secondary} />}

      <View style={GlobalStyles.spread}>
        <Text style={Type.label}>AIR CONDITIONING</Text>
        <View style={GlobalStyles.chip}>
          <Text style={Type.label}>PLACEHOLDER</Text>
        </View>
      </View>

      <View style={[GlobalStyles.tile, styles.acRow]}>
        {on ? (
          <Spin>
            <SymbolView
              name={{ ios: 'fan.fill', android: 'mode_fan', web: 'mode_fan' }}
              tintColor={accent}
              size={16}
            />
          </Spin>
        ) : (
          <SymbolView
            name={{ ios: 'fan.fill', android: 'mode_fan', web: 'mode_fan' }}
            tintColor={accent}
            size={16}
          />
        )}
        <Text style={[Type.body, styles.acLabel]}>FAN</Text>
        <Text style={[styles.acValue, { color: accent }]}>{on ? fan.toUpperCase() : 'OFF'}</Text>
      </View>

      <View style={[GlobalStyles.tile, styles.acRow]}>
        <SymbolView
          name={{ ios: 'snowflake', android: 'ac_unit', web: 'ac_unit' }}
          tintColor={accent}
          size={16}
        />
        <Text style={[Type.body, styles.acLabel]}>SET</Text>
        <Text style={[styles.acValue, { color: accent }]}>
          {setpoint.toFixed(1)}
          <Text style={Type.mono}>°C</Text>
        </Text>
      </View>
    </Panel>
  );
}

const NO_LIGHT: RoomLightState = { entityId: null, on: false, unavailable: false };

/** Rooms two per row, with Outdoor spanning the full width beneath them. */
function RoomsGrid() {
  const allRooms = useMemo(() => [...ROOMS, OUTDOOR_ROOM], []);
  const { states, toggle } = useRoomLights(allRooms);
  const presence = useRoomPresence(allRooms);
  const [openRoom, setOpenRoom] = useState<Room | null>(null);

  return (
    <View style={styles.roomGrid}>
      {ROOMS.map((room) => (
        <RoomCard
          key={room.name}
          room={room}
          light={states.get(room.name) ?? NO_LIGHT}
          presence={presence.get(room.name)}
          onToggle={toggle}
          onOpen={setOpenRoom}
        />
      ))}
      <RoomCard
        room={OUTDOOR_ROOM}
        light={states.get(OUTDOOR_ROOM.name) ?? NO_LIGHT}
        presence={presence.get(OUTDOOR_ROOM.name)}
        onToggle={toggle}
        onOpen={setOpenRoom}
        fullWidth
      />

      <RoomModal
        room={openRoom}
        presence={openRoom ? presence.get(openRoom.name) : undefined}
        visible={!!openRoom}
        onClose={() => setOpenRoom(null)}
      />
    </View>
  );
}

export default function HomeScreen() {
  const { status, error } = useHomeAssistantContext();
  const clock = useHaTime();
  const connected = status === 'connected';

  return (
    <View style={GlobalStyles.screen}>
      <SafeAreaView style={GlobalStyles.content} edges={['bottom', 'left', 'right']}>
        <View style={styles.columns}>
          {/* Left third: clock, today's weather, live power — stacked. */}
          <View style={styles.sideColumn}>
            <ClockPanel clock={clock} />
            {connected ? (
              <>
                <WeatherPanel now={clock.now} />
                <PowerPanel clock={clock} />
              </>
            ) : (
              <Panel style={styles.weatherPanel}>
                <Text style={Type.label}>HOME ASSISTANT</Text>
                <ConnectionNotice status={status} error={error} />
              </Panel>
            )}
          </View>

          {/* The remaining two thirds: room cards in the centre, readouts pinned right. */}
          <View style={styles.mainArea}>
            <View style={styles.centerColumn}>{connected && <RoomsGrid />}</View>

            <View style={styles.rightColumn}>
              {connected && (
                <>
                  <PoolPanel />
                  <ThermostatsPanel />
                  <AcPanel />
                </>
              )}
            </View>
          </View>
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
  /** Keeps the left column at exactly a third; the centre takes whatever the fixed-width
   * right-hand stack leaves. */
  mainArea: {
    flex: 2,
    flexDirection: 'row',
    gap: Spacing.three,
  },
  centerColumn: {
    flex: 1,
  },
  rightColumn: {
    width: SIDE_CARD_WIDTH,
    gap: Spacing.three,
  },
  roomGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.three,
  },
  thermostatPanel: {
    width: SIDE_CARD_WIDTH,
  },
  thermostatStack: {
    gap: Spacing.two,
  },
  acPanel: {
    width: SIDE_CARD_WIDTH,
  },
  /** Mirrors a thermostat row so the column reads as one stack. */
  acRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    height: 42,
  },
  acLabel: {
    flex: 1,
    letterSpacing: 0.8,
    color: Palette.textMuted,
  },
  acValue: {
    ...Type.monoBright,
    fontSize: 18,
    lineHeight: 22,
    width: 68,
    textAlign: 'right',
  },
  heatingLabel: {
    color: Palette.warn,
  },
  poolPanel: {
    width: SIDE_CARD_WIDTH,
    gap: Spacing.two,
  },
  poolBody: {
    gap: Spacing.two,
  },
  poolRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  poolTemp: {
    fontSize: 22,
    lineHeight: 26,
    color: Palette.secondary,
  },
  ledOn: {
    backgroundColor: Palette.primary,
  },
  ledWarn: {
    backgroundColor: Palette.warn,
  },
  warnText: {
    color: Palette.warn,
  },
  clockPanel: {
    gap: Spacing.one,
  },
  weatherPanel: {
    flex: 1,
    justifyContent: 'space-between',
  },
  /** The part that slides; the panel border and the page dots stay put around it. */
  weatherBody: {
    flex: 1,
    justifyContent: 'space-between',
    gap: Spacing.two,
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
  dayNav: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  todayChip: {
    color: Palette.primary,
  },
  pageDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.one,
  },
  pageDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: Palette.border,
  },
  pageDotOn: {
    backgroundColor: Palette.primary,
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
  powerBody: {
    gap: Spacing.two,
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
