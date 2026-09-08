import { SymbolView } from 'expo-symbols';
import { useMemo, type ComponentProps } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

import { BIRTHDAY_CALENDAR_ENTITY_ID, COLLECTION_CALENDAR_ENTITY_ID } from '@/config/agenda';
import { SWIPE_DISTANCE, SWIPE_SLOP, SWIPE_VELOCITY } from '@/constants/gestures';
import { GlobalStyles, Palette, Radius, Spacing, Type } from '@/constants/styles';
import type { CalendarEvent } from '@/hooks/use-agenda';

const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

export type DayBadge = 'garbage' | 'recycling' | 'compost' | 'birthday';

/** Drawn left-to-right in this order so a day's icons never shuffle between renders. */
const BADGE_ORDER: DayBadge[] = ['garbage', 'recycling', 'compost', 'birthday'];

const BADGE_ICONS: Record<DayBadge, ComponentProps<typeof SymbolView>['name']> = {
  garbage: { ios: 'trash.fill', android: 'delete', web: 'delete' },
  recycling: { ios: 'arrow.3.trianglepath', android: 'recycling', web: 'recycling' },
  compost: { ios: 'leaf.fill', android: 'compost', web: 'compost' },
  birthday: { ios: 'birthday.cake.fill', android: 'cake', web: 'cake' },
};

/** Lowercase and strip accents, so 'Récupération' and 'Recuperation' both match. */
function normalize(s: string) {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // combining accents left behind by NFD
    .toLowerCase();
}

/**
 * Which marker, if any, an event earns. The pickup calendar is the Ville de Lévis feed, whose
 * summaries are French ('Récupération | …', 'Compostage | …', 'Déchets domestiques | …'); the
 * English words are matched too in case the source is ever swapped for an English one.
 */
export function badgeForEvent(event: CalendarEvent): DayBadge | null {
  if (event.calendar === BIRTHDAY_CALENDAR_ENTITY_ID) return 'birthday';

  const text = normalize(event.summary ?? '');
  if (/anniversaire|birthday/.test(text)) return 'birthday';
  if (/compost/.test(text)) return 'compost';
  if (/recup|recycl/.test(text)) return 'recycling';
  if (/dechet|ordure|garbage|trash/.test(text)) return 'garbage';
  return null;
}

/**
 * Badges per day key, deduplicated — two compost events on one day still draw one leaf.
 */
export function badgesByDay(events: CalendarEvent[]): Map<string, DayBadge[]> {
  const found = new Map<string, Set<DayBadge>>();
  for (const event of events) {
    const badge = badgeForEvent(event);
    if (!badge) continue;
    for (const key of eventDayKeys(event)) {
      const set = found.get(key) ?? new Set<DayBadge>();
      set.add(badge);
      found.set(key, set);
    }
  }
  return new Map(
    [...found].map(([key, set]) => [key, BADGE_ORDER.filter((b) => set.has(b))] as const),
  );
}

export function toDayKey(d: Date) {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/**
 * Day keys an event covers. All-day events use plain 'YYYY-MM-DD' with an exclusive end,
 * so the last day must not be included; timed events carry a full ISO datetime.
 */
export function eventDayKeys(event: CalendarEvent): string[] {
  const allDay = !event.start.includes('T') && !event.start.includes(' ');
  const start = new Date(allDay ? `${event.start}T00:00:00` : event.start);
  const end = new Date(allDay ? `${event.end}T00:00:00` : event.end);
  if (Number.isNaN(start.getTime())) return [];

  const keys: string[] = [];
  const cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const last = Number.isNaN(end.getTime()) ? cursor : end;

  while (cursor < last || keys.length === 0) {
    keys.push(toDayKey(cursor));
    cursor.setDate(cursor.getDate() + 1);
    if (keys.length > 366) break; // guard against a malformed range
    if (!allDay && cursor >= last) break;
  }
  return keys;
}

/**
 * Monday-first grid covering the whole month, padded to complete weeks and grouped into rows
 * of exactly seven. The grouping matters: laying all 42 cells out as one `flexWrap` row with
 * `width: 100/7 %` drops the last column, because seven rounded-up percentage widths add up to
 * slightly more than the container and Yoga wraps the seventh cell onto its own line.
 */
function buildGrid(monthAnchor: Date) {
  const first = new Date(monthAnchor.getFullYear(), monthAnchor.getMonth(), 1);
  const offset = (first.getDay() + 6) % 7; // JS weeks start Sunday; shift to Monday
  const gridStart = new Date(first);
  gridStart.setDate(first.getDate() - offset);

  const days: Date[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    days.push(d);
  }
  // Trim a trailing all-next-month week when the month doesn't need 6 rows.
  const used = days.slice(0, days[35].getMonth() === monthAnchor.getMonth() ? 42 : 35);

  const weeks: Date[][] = [];
  for (let i = 0; i < used.length; i += 7) weeks.push(used.slice(i, i + 7));
  return weeks;
}

export function MonthCalendar({
  monthAnchor,
  events,
  selectedKey,
  todayKey,
  onSelectDay,
  onChangeMonth,
}: {
  monthAnchor: Date;
  events: CalendarEvent[];
  selectedKey: string;
  /** Which day to ring as today. Passed in so it tracks the Home Assistant clock rather
   * than being captured from the device at render time. */
  todayKey: string;
  onSelectDay: (key: string) => void;
  onChangeMonth: (delta: number) => void;
}) {
  // Curbside pickups are already spoken for by the watermark icons, so they don't also earn
  // a dot — otherwise every Friday reads as a busy day.
  const countByDay = new Map<string, number>();
  for (const e of events) {
    if (e.calendar === COLLECTION_CALENDAR_ENTITY_ID) continue;
    for (const key of eventDayKeys(e)) {
      countByDay.set(key, (countByDay.get(key) ?? 0) + 1);
    }
  }

  const badges = badgesByDay(events);

  const weeks = buildGrid(monthAnchor);

  const swipe = useMemo(
    () =>
      Gesture.Pan()
        // Only take over once the drag is clearly horizontal, so a vertical one still
        // belongs to whatever is scrolling, and a tap on a day still registers as a tap.
        .activeOffsetX([-SWIPE_SLOP, SWIPE_SLOP])
        .failOffsetY([-SWIPE_SLOP, SWIPE_SLOP])
        // The callback sets React state, so it has to run on the JS thread rather than as
        // a worklet on the UI thread.
        .runOnJS(true)
        .onEnd((e) => {
          const farEnough = Math.abs(e.translationX) > SWIPE_DISTANCE;
          const fastEnough = Math.abs(e.velocityX) > SWIPE_VELOCITY;
          if (!farEnough && !fastEnough) return;
          // Dragging left pulls the next month in from the right, as on iOS calendars.
          onChangeMonth(e.translationX < 0 ? 1 : -1);
        }),
    [onChangeMonth],
  );

  return (
    <GestureDetector gesture={swipe}>
      <View style={styles.wrapper}>
        <View style={styles.header}>
          <Pressable
            onPress={() => onChangeMonth(-1)}
            accessibilityRole="button"
            accessibilityLabel="Previous month"
            hitSlop={8}
            style={({ pressed }) => pressed && GlobalStyles.pressed}
          >
            <SymbolView
              name={{ ios: 'chevron.left', android: 'chevron_left', web: 'chevron_left' }}
              tintColor={Palette.primary}
              size={20}
            />
          </Pressable>
          <Text style={Type.heading}>
            {monthAnchor.toLocaleDateString([], { month: 'long', year: 'numeric' }).toUpperCase()}
          </Text>
          <Pressable
            onPress={() => onChangeMonth(1)}
            accessibilityRole="button"
            accessibilityLabel="Next month"
            hitSlop={8}
            style={({ pressed }) => pressed && GlobalStyles.pressed}
          >
            <SymbolView
              name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }}
              tintColor={Palette.primary}
              size={20}
            />
          </Pressable>
        </View>

        <View style={styles.weekRow}>
          {WEEKDAYS.map((w) => (
            <Text key={w} style={[Type.label, styles.weekday]}>
              {w.toUpperCase()}
            </Text>
          ))}
        </View>

        <View style={styles.grid}>
          {weeks.map((week) => (
            <View key={toDayKey(week[0])} style={styles.weekDays}>
              {week.map((d) => {
                const key = toDayKey(d);
                const inMonth = d.getMonth() === monthAnchor.getMonth();
                const isToday = key === todayKey;
                const isSelected = key === selectedKey;
                const count = countByDay.get(key) ?? 0;
                const dayBadges = badges.get(key) ?? [];
                // Shrink as more pile up (compost + pickup + a birthday can share a day) so
                // the row stays inside the cell instead of wrapping onto the number.
                const badgeSize = dayBadges.length >= 3 ? 14 : dayBadges.length === 2 ? 17 : 20;

                return (
                  <Pressable
                    key={key}
                    onPress={() => onSelectDay(key)}
                    accessibilityRole="button"
                    accessibilityLabel={[d.toDateString(), ...dayBadges].join(', ')}
                    accessibilityState={{ selected: isSelected }}
                    style={styles.dayCell}
                  >
                    <View
                      style={[
                        styles.dayInner,
                        isSelected && styles.daySelected,
                        isToday && styles.dayToday,
                      ]}
                    >
                      {dayBadges.length > 0 && (
                        <View
                          style={[styles.badgeLayer, !inMonth && styles.badgeLayerOutside]}
                          pointerEvents="none"
                        >
                          {dayBadges.map((badge) => (
                            <SymbolView
                              key={badge}
                              name={BADGE_ICONS[badge]}
                              tintColor={Palette.text}
                              size={badgeSize}
                            />
                          ))}
                        </View>
                      )}
                      <Text
                        style={[
                          Type.body,
                          !inMonth && styles.outsideMonth,
                          isToday && styles.todayText,
                        ]}
                      >
                        {d.getDate()}
                      </Text>
                      <View style={styles.dotRow}>
                        {count > 0 &&
                          Array.from({ length: Math.min(count, 3) }).map((_, i) => (
                            <View key={i} style={styles.dot} />
                          ))}
                      </View>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: Spacing.two,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.two,
  },
  weekRow: {
    flexDirection: 'row',
  },
  weekday: {
    flex: 1,
    textAlign: 'center',
  },
  /** Holds the week rows tight together, out of `wrapper`'s gap. */
  grid: {
    gap: 0,
  },
  /** One row per week — see buildGrid for why the cells aren't wrapped percentages. */
  weekDays: {
    flexDirection: 'row',
  },
  dayCell: {
    flex: 1,
    aspectRatio: 1.15,
    padding: 2,
  },
  dayInner: {
    flex: 1,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: 'transparent',
    backgroundColor: Palette.panelDeep,
    alignItems: 'center',
    // Date pinned to the top, event dots to the bottom, watermark centred behind both.
    justifyContent: 'space-between',
    paddingVertical: 3,
  },
  daySelected: {
    backgroundColor: Palette.panelActive,
    borderColor: Palette.primary,
  },
  dayToday: {
    borderColor: Palette.secondary,
  },
  todayText: {
    color: Palette.secondary,
    fontWeight: '700',
  },
  outsideMonth: {
    opacity: 0.35,
  },
  /**
   * Sits behind the date and the event dots: absolutely filling the cell keeps it out of the
   * layout, and rendering it before its siblings puts it underneath them. Bright enough to read
   * across the room against the deep indigo cell, still faint enough to stay a watermark
   * behind the date.
   */
  badgeLayer: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    alignContent: 'center',
    justifyContent: 'center',
    gap: 1,
    opacity: 0.6,
  },
  /** Fainter still on the padding days, which are themselves dimmed. */
  badgeLayerOutside: {
    opacity: 0.32,
  },
  dotRow: {
    flexDirection: 'row',
    gap: 2,
    height: 4,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: Palette.primary,
  },
});
