import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import type { CalendarEvent } from '@/hooks/use-agenda';
import { useTheme } from '@/hooks/use-theme';

const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

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

/** Monday-first grid covering the whole month, padded to complete weeks. */
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
  return days.slice(0, days[35].getMonth() === monthAnchor.getMonth() ? 42 : 35);
}

export function MonthCalendar({
  monthAnchor,
  events,
  selectedKey,
  onSelectDay,
  onChangeMonth,
}: {
  monthAnchor: Date;
  events: CalendarEvent[];
  selectedKey: string;
  onSelectDay: (key: string) => void;
  onChangeMonth: (delta: number) => void;
}) {
  const theme = useTheme();
  const todayKey = toDayKey(new Date());

  const countByDay = new Map<string, number>();
  for (const e of events) {
    for (const key of eventDayKeys(e)) {
      countByDay.set(key, (countByDay.get(key) ?? 0) + 1);
    }
  }

  const days = buildGrid(monthAnchor);

  return (
    <View style={styles.wrapper}>
      <View style={styles.header}>
        <Pressable
          onPress={() => onChangeMonth(-1)}
          accessibilityRole="button"
          accessibilityLabel="Previous month"
          hitSlop={8}
          style={({ pressed }) => pressed && styles.pressed}>
          <SymbolView
            name={{ ios: 'chevron.left', android: 'chevron_left', web: 'chevron_left' }}
            tintColor={theme.textSecondary}
            size={20}
          />
        </Pressable>
        <ThemedText type="smallBold">
          {monthAnchor.toLocaleDateString([], { month: 'long', year: 'numeric' })}
        </ThemedText>
        <Pressable
          onPress={() => onChangeMonth(1)}
          accessibilityRole="button"
          accessibilityLabel="Next month"
          hitSlop={8}
          style={({ pressed }) => pressed && styles.pressed}>
          <SymbolView
            name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }}
            tintColor={theme.textSecondary}
            size={20}
          />
        </Pressable>
      </View>

      <View style={styles.weekRow}>
        {WEEKDAYS.map((w) => (
          <ThemedText key={w} type="code" themeColor="textSecondary" style={styles.weekday}>
            {w}
          </ThemedText>
        ))}
      </View>

      <View style={styles.grid}>
        {days.map((d) => {
          const key = toDayKey(d);
          const inMonth = d.getMonth() === monthAnchor.getMonth();
          const isToday = key === todayKey;
          const isSelected = key === selectedKey;
          const count = countByDay.get(key) ?? 0;

          return (
            <Pressable
              key={key}
              onPress={() => onSelectDay(key)}
              accessibilityRole="button"
              accessibilityLabel={d.toDateString()}
              accessibilityState={{ selected: isSelected }}
              style={styles.dayCell}>
              <ThemedView
                type={isSelected ? 'backgroundSelected' : 'background'}
                style={[styles.dayInner, isToday && { borderColor: '#3c87f7', borderWidth: 1.5 }]}>
                <ThemedText
                  type={isToday ? 'smallBold' : 'small'}
                  themeColor={inMonth ? 'text' : 'textSecondary'}
                  style={!inMonth && styles.outsideMonth}>
                  {d.getDate()}
                </ThemedText>
                <View style={styles.dotRow}>
                  {count > 0 &&
                    Array.from({ length: Math.min(count, 3) }).map((_, i) => (
                      <View key={i} style={[styles.dot, { backgroundColor: theme.text }]} />
                    ))}
                </View>
              </ThemedView>
            </Pressable>
          );
        })}
      </View>
    </View>
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
  pressed: {
    opacity: 0.6,
  },
  weekRow: {
    flexDirection: 'row',
  },
  weekday: {
    flex: 1,
    textAlign: 'center',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: `${100 / 7}%`,
    aspectRatio: 1.15,
    padding: 2,
  },
  dayInner: {
    flex: 1,
    borderRadius: Spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  outsideMonth: {
    opacity: 0.4,
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
  },
});
