import { SymbolView } from 'expo-symbols';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ConnectionNotice } from '@/components/connection-notice';
import { MonthCalendar, eventDayKeys, toDayKey } from '@/components/month-calendar';
import { Panel } from '@/components/panel';
import { GlobalStyles, Palette, Radius, Spacing, Type } from '@/constants/styles';
import { useAgenda, type CalendarEvent, type TodoItem } from '@/hooks/use-agenda';
import { useHaTime } from '@/hooks/use-ha-time';
import { useHomeAssistantContext } from '@/providers/home-assistant-provider';

function isAllDay(event: CalendarEvent) {
  return !event.start.includes('T') && !event.start.includes(' ');
}

function eventTimeLabel(event: CalendarEvent) {
  if (isAllDay(event)) return 'ALL DAY';
  const start = new Date(event.start);
  const end = new Date(event.end);
  const fmt = (d: Date) => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return Number.isNaN(end.getTime()) ? fmt(start) : `${fmt(start)} – ${fmt(end)}`;
}

/** Midnight of the given date, so day comparisons ignore the clock. */
function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function parseDue(due: string) {
  const d = new Date(due.includes('T') ? due : `${due}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Time of day for a task that has one; grouping already carries the date. */
function dueTimeLabel(due?: string) {
  if (!due || !due.includes('T')) return null;
  const d = parseDue(due);
  return d ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null;
}

interface TaskGroup {
  key: string;
  /** Weekday, day and month — e.g. "MONDAY, 8 SEPTEMBER". */
  label: string;
  /** Relative marker shown beside the label: OVERDUE / TODAY / TOMORROW. */
  note: string | null;
  overdue: boolean;
  items: TodoItem[];
}

/**
 * Split the open tasks into one group per due day, oldest first, with undated tasks last.
 * Each group's label carries the weekday plus the day and month, which is what the divider
 * in the list renders.
 *
 * `now` is passed in rather than read here so OVERDUE/TODAY/TOMORROW follow the same Home
 * Assistant clock as the rest of the page.
 */
function groupByDay(items: TodoItem[], now: Date): TaskGroup[] {
  const today = startOfDay(now);
  const byKey = new Map<string, { date: Date | null; items: TodoItem[] }>();

  for (const item of items) {
    const date = item.due ? parseDue(item.due) : null;
    const key = date ? toDayKey(date) : '';
    const group = byKey.get(key) ?? { date: date ? startOfDay(date) : null, items: [] };
    group.items.push(item);
    byKey.set(key, group);
  }

  return (
    [...byKey.entries()]
      // Undated tasks sort to the bottom; everything else runs oldest to newest.
      .sort(([, ga], [, gb]) => {
        if (!ga.date) return 1;
        if (!gb.date) return -1;
        return ga.date.getTime() - gb.date.getTime();
      })
      .map(([key, group]) => {
        if (!group.date) {
          return {
            key: 'undated',
            label: 'NO DUE DATE',
            note: null,
            overdue: false,
            items: group.items,
          };
        }
        const dayDiff = Math.round((group.date.getTime() - today.getTime()) / 86400000);
        const note =
          dayDiff < 0 ? 'OVERDUE' : dayDiff === 0 ? 'TODAY' : dayDiff === 1 ? 'TOMORROW' : null;
        return {
          key,
          label: group.date
            .toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' })
            .toUpperCase(),
          note,
          overdue: dayDiff < 0,
          items: group.items,
        };
      })
  );
}

/** Label + hairline rule; the list's day separator. */
function DayDivider({
  label,
  note,
  count,
  tone,
}: {
  label: string;
  note?: string | null;
  count?: number;
  tone?: 'default' | 'warn';
}) {
  return (
    <View style={[GlobalStyles.divider, styles.dayDivider]}>
      <Text style={[Type.label, tone === 'warn' && styles.warnText]}>{label}</Text>
      {!!note && (
        <View style={[GlobalStyles.chip, tone === 'warn' && styles.warnChip]}>
          <Text style={[Type.label, tone === 'warn' && styles.warnText]}>{note}</Text>
        </View>
      )}
      <View style={GlobalStyles.dividerRule} />
      {count !== undefined && <Text style={Type.label}>{String(count).padStart(2, '0')}</Text>}
    </View>
  );
}

function TaskRow({
  item,
  onToggle,
}: {
  item: TodoItem;
  onToggle: (uid: string, next: 'completed' | 'needs_action') => Promise<void>;
}) {
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const done = item.status === 'completed';
  const time = dueTimeLabel(item.due);

  const toggle = async () => {
    if (pending) return;
    setPending(true);
    setFailed(null);
    try {
      await onToggle(item.uid, done ? 'needs_action' : 'completed');
    } catch (e) {
      setFailed(e instanceof Error ? e.message : 'Failed to update task');
    } finally {
      setPending(false);
    }
  };

  return (
    <Pressable
      onPress={toggle}
      disabled={pending}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: done, disabled: pending }}
      accessibilityLabel={item.summary}
      style={({ pressed }) => [
        GlobalStyles.tile,
        styles.taskRow,
        done && styles.taskRowDone,
        pressed && GlobalStyles.pressed,
      ]}
    >
      <View style={styles.checkbox}>
        {pending ? (
          <ActivityIndicator size="small" color={Palette.textMuted} />
        ) : (
          <SymbolView
            name={
              done
                ? { ios: 'checkmark.circle.fill', android: 'check_circle', web: 'check_circle' }
                : {
                    ios: 'circle',
                    android: 'radio_button_unchecked',
                    web: 'radio_button_unchecked',
                  }
            }
            tintColor={done ? Palette.textMuted : Palette.primary}
            size={20}
          />
        )}
      </View>

      <View style={styles.taskText}>
        <Text style={[Type.body, done && styles.completed, done && Type.bodyMuted]}>
          {item.summary}
        </Text>
        {failed && <Text style={[Type.mono, GlobalStyles.error]}>{failed}</Text>}
      </View>

      {!!time && !failed && <Text style={Type.mono}>{time}</Text>}
    </Pressable>
  );
}

export default function TasksScreen() {
  const { status, error: connectionError } = useHomeAssistantContext();

  // The panel runs for days at a time, so today can't be captured once at mount — it comes
  // from the Home Assistant clock and is re-derived on every tick.
  const { now } = useHaTime();
  const todayKey = toDayKey(now);
  const currentMonthKey = `${now.getFullYear()}-${now.getMonth()}`;

  // A tap pins a day, but only for the rest of that day: each pin records the day it was
  // made on, so once the date rolls over the page snaps back to the new today by itself.
  const [pinnedDay, setPinnedDay] = useState<{ key: string; madeOn: string } | null>(null);
  const [pinnedMonth, setPinnedMonth] = useState<{ key: string; madeOn: string } | null>(null);

  const selectedKey = pinnedDay?.madeOn === todayKey ? pinnedDay.key : todayKey;
  const monthKey = pinnedMonth?.madeOn === todayKey ? pinnedMonth.key : currentMonthKey;

  // Derived from the month key rather than from `now`, so a fresh Date every minute doesn't
  // invalidate the fetch range below and re-request the whole month.
  const monthAnchor = useMemo(() => {
    const [year, month] = monthKey.split('-').map(Number);
    return new Date(year, month, 1);
  }, [monthKey]);

  // Stamped with the Home Assistant day, not the device's: they are compared against
  // `todayKey`, and on a tablet whose own clock is wrong a device-stamped pin would never
  // match and would be discarded the instant it was made.
  const selectDay = useCallback(
    (key: string) => setPinnedDay({ key, madeOn: todayKey }),
    [todayKey],
  );

  // Fetch a little beyond the visible grid so events from adjacent months still show.
  const { monthStart, monthEnd } = useMemo(() => {
    const start = new Date(monthAnchor.getFullYear(), monthAnchor.getMonth(), 1);
    start.setDate(start.getDate() - 7);
    const end = new Date(monthAnchor.getFullYear(), monthAnchor.getMonth() + 1, 1);
    end.setDate(end.getDate() + 7);
    return { monthStart: start, monthEnd: end };
  }, [monthAnchor]);

  const { events, items, todosLoading, error, connected, setItemStatus } = useAgenda(
    monthStart,
    monthEnd,
  );

  // Stable identity: MonthCalendar builds its swipe gesture from this, and a fresh callback
  // every render would rebuild the gesture every render too.
  const changeMonth = useCallback(
    (delta: number) => {
      const [year, month] = monthKey.split('-').map(Number);
      const next = new Date(year, month + delta, 1);
      setPinnedMonth({ key: `${next.getFullYear()}-${next.getMonth()}`, madeOn: todayKey });
    },
    [monthKey, todayKey],
  );

  const selectedEvents = useMemo(
    () => events.filter((e) => eventDayKeys(e).includes(selectedKey)),
    [events, selectedKey],
  );

  const { groups, open, done } = useMemo(() => {
    const openItems = items.filter((i) => i.status !== 'completed');
    return {
      open: openItems,
      done: items.filter((i) => i.status === 'completed'),
      groups: groupByDay(openItems, now),
    };
  }, [items, now]);

  if (!connected) {
    return (
      <View style={GlobalStyles.screen}>
        <SafeAreaView style={GlobalStyles.content} edges={['bottom', 'left', 'right']}>
          <Text style={Type.title}>TASKS &amp; CALENDAR</Text>
          <ConnectionNotice status={status} error={connectionError} />
        </SafeAreaView>
      </View>
    );
  }

  const selectedDate = new Date(`${selectedKey}T00:00:00`);

  return (
    <View style={GlobalStyles.screen}>
      <SafeAreaView style={GlobalStyles.content} edges={['bottom', 'left', 'right']}>
        {error && <Text style={[Type.mono, GlobalStyles.error]}>{error}</Text>}

        <View style={styles.columns}>
          {/* Left: month grid, then the events on the selected day. */}
          <View style={styles.calendarColumn}>
            <Panel>
              <MonthCalendar
                monthAnchor={monthAnchor}
                events={events}
                selectedKey={selectedKey}
                onSelectDay={selectDay}
                todayKey={todayKey}
                onChangeMonth={changeMonth}
              />
            </Panel>

            <Panel style={styles.flexPanel}>
              <DayDivider
                label={selectedDate
                  .toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' })
                  .toUpperCase()}
                count={selectedEvents.length}
              />
              <ScrollView
                contentContainerStyle={GlobalStyles.listContent}
                showsVerticalScrollIndicator={false}
              >
                {selectedEvents.length === 0 ? (
                  <Text style={Type.bodyMuted}>No events</Text>
                ) : (
                  selectedEvents.map((e, i) => (
                    <View key={`${e.start}-${i}`} style={[GlobalStyles.tile, styles.eventRow]}>
                      <Text style={[Type.mono, styles.eventTime]}>{eventTimeLabel(e)}</Text>
                      <View style={styles.eventBody}>
                        <Text style={Type.body}>{e.summary}</Text>
                        {!!e.location && <Text style={Type.mono}>{e.location}</Text>}
                      </View>
                    </View>
                  ))
                )}
              </ScrollView>
            </Panel>
          </View>

          {/* Right: Todoist Inbox, grouped by due day. */}
          <Panel style={styles.tasksColumn}>
            <View style={GlobalStyles.spread}>
              <Text style={Type.heading}>INBOX</Text>
              {todosLoading ? (
                <ActivityIndicator size="small" color={Palette.textMuted} />
              ) : (
                <Text style={Type.label}>{open.length} OPEN</Text>
              )}
            </View>

            <ScrollView
              contentContainerStyle={GlobalStyles.listContent}
              showsVerticalScrollIndicator={false}
            >
              {open.length === 0 && done.length === 0 && !todosLoading && (
                <Text style={Type.bodyMuted}>No tasks</Text>
              )}

              {groups.map((group) => (
                <View key={group.key} style={styles.group}>
                  <DayDivider
                    label={group.label}
                    note={group.note}
                    count={group.items.length}
                    tone={group.overdue ? 'warn' : 'default'}
                  />
                  {group.items.map((item) => (
                    <TaskRow key={item.uid} item={item} onToggle={setItemStatus} />
                  ))}
                </View>
              ))}

              {done.length > 0 && (
                <View style={styles.group}>
                  <DayDivider label="COMPLETED" count={done.length} />
                  {done.map((item) => (
                    <TaskRow key={item.uid} item={item} onToggle={setItemStatus} />
                  ))}
                </View>
              )}
            </ScrollView>
          </Panel>
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
  calendarColumn: {
    flex: 1.2,
    gap: Spacing.three,
  },
  /** Panels that host a ScrollView must be bounded, not sized by their content. */
  flexPanel: {
    flex: 1,
  },
  tasksColumn: {
    flex: 1,
  },
  group: {
    gap: Spacing.two,
  },
  dayDivider: {
    paddingTop: Spacing.one,
  },
  warnText: {
    color: Palette.warn,
  },
  warnChip: {
    borderColor: Palette.warn,
  },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  taskRowDone: {
    opacity: 0.55,
  },
  checkbox: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  taskText: {
    flex: 1,
    gap: 2,
  },
  completed: {
    textDecorationLine: 'line-through',
  },
  eventRow: {
    flexDirection: 'row',
    gap: Spacing.three,
    borderRadius: Radius.sm,
  },
  eventTime: {
    width: 92,
  },
  eventBody: {
    flex: 1,
    gap: 2,
  },
});
