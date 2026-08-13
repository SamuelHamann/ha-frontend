import { SymbolView } from 'expo-symbols';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ConnectionNotice } from '@/components/connection-notice';
import { MonthCalendar, eventDayKeys, toDayKey } from '@/components/month-calendar';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useAgenda, type CalendarEvent, type TodoItem } from '@/hooks/use-agenda';
import { useTheme } from '@/hooks/use-theme';
import { useHomeAssistantContext } from '@/providers/home-assistant-provider';

function isAllDay(event: CalendarEvent) {
  return !event.start.includes('T') && !event.start.includes(' ');
}

function eventTimeLabel(event: CalendarEvent) {
  if (isAllDay(event)) return 'All day';
  const start = new Date(event.start);
  const end = new Date(event.end);
  const fmt = (d: Date) => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return Number.isNaN(end.getTime()) ? fmt(start) : `${fmt(start)} – ${fmt(end)}`;
}

function dueLabel(due?: string) {
  if (!due) return null;
  const d = new Date(due.includes('T') ? due : `${due}T00:00:00`);
  if (Number.isNaN(d.getTime())) return due;

  const today = new Date();
  const dayDiff = Math.round(
    (new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() -
      new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()) /
      86400000,
  );
  if (dayDiff === 0) return 'Today';
  if (dayDiff === 1) return 'Tomorrow';
  if (dayDiff === -1) return 'Yesterday';
  if (dayDiff < 0) return `${Math.abs(dayDiff)}d overdue`;
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function isOverdue(item: TodoItem) {
  if (!item.due || item.status === 'completed') return false;
  const d = new Date(item.due.includes('T') ? item.due : `${item.due}T23:59:59`);
  return !Number.isNaN(d.getTime()) && d.getTime() < Date.now();
}

function TaskRow({
  item,
  onToggle,
}: {
  item: TodoItem;
  onToggle: (uid: string, next: 'completed' | 'needs_action') => Promise<void>;
}) {
  const theme = useTheme();
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const done = item.status === 'completed';
  const overdue = isOverdue(item);
  const due = dueLabel(item.due);

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
    <ThemedView type="backgroundElement" style={styles.taskRow}>
      <Pressable
        onPress={toggle}
        disabled={pending}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: done, disabled: pending }}
        accessibilityLabel={item.summary}
        hitSlop={8}
        style={({ pressed }) => [styles.checkbox, pressed && styles.pressed]}>
        {pending ? (
          <ActivityIndicator size="small" color={theme.textSecondary} />
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
            tintColor={done ? theme.textSecondary : theme.text}
            size={20}
          />
        )}
      </Pressable>

      <View style={styles.taskText}>
        <ThemedText
          type="small"
          themeColor={done ? 'textSecondary' : 'text'}
          style={done && styles.completed}>
          {item.summary}
        </ThemedText>
        {failed ? (
          <ThemedText type="code" style={styles.overdue}>
            {failed}
          </ThemedText>
        ) : (
          due && (
            <ThemedText type="code" themeColor="textSecondary" style={overdue && styles.overdue}>
              {due}
            </ThemedText>
          )
        )}
      </View>
    </ThemedView>
  );
}

export default function TasksScreen() {
  const { status, error: connectionError } = useHomeAssistantContext();
  const [monthAnchor, setMonthAnchor] = useState(() => new Date());
  const [selectedKey, setSelectedKey] = useState(() => toDayKey(new Date()));

  // Fetch a little beyond the visible grid so events from adjacent months still show.
  const { monthStart, monthEnd } = useMemo(() => {
    const start = new Date(monthAnchor.getFullYear(), monthAnchor.getMonth(), 1);
    start.setDate(start.getDate() - 7);
    const end = new Date(monthAnchor.getFullYear(), monthAnchor.getMonth() + 1, 1);
    end.setDate(end.getDate() + 7);
    return { monthStart: start, monthEnd: end };
  }, [monthAnchor]);

  const { events, items, loading, error, connected, setItemStatus } = useAgenda(
    monthStart,
    monthEnd,
  );

  const selectedEvents = useMemo(
    () => events.filter((e) => eventDayKeys(e).includes(selectedKey)),
    [events, selectedKey],
  );

  const { open, done } = useMemo(
    () => ({
      open: items.filter((i) => i.status !== 'completed'),
      done: items.filter((i) => i.status === 'completed'),
    }),
    [items],
  );

  if (!connected) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea} edges={['bottom', 'left', 'right']}>
          <ThemedText type="subtitle">Tasks &amp; calendar</ThemedText>
          <ConnectionNotice status={status} error={connectionError} />
        </SafeAreaView>
      </ThemedView>
    );
  }

  const selectedDate = new Date(`${selectedKey}T00:00:00`);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['bottom', 'left', 'right']}>
        {error && (
          <ThemedText type="small" style={styles.error}>
            {error}
          </ThemedText>
        )}

        <View style={styles.columns}>
          {/* Left: calendar */}
          <View style={styles.calendarColumn}>
            <MonthCalendar
              monthAnchor={monthAnchor}
              events={events}
              selectedKey={selectedKey}
              onSelectDay={setSelectedKey}
              onChangeMonth={(delta) =>
                setMonthAnchor((m) => new Date(m.getFullYear(), m.getMonth() + delta, 1))
              }
            />

            <ThemedText type="small" themeColor="textSecondary" style={styles.sectionLabel}>
              {selectedDate.toLocaleDateString([], {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
              })}
            </ThemedText>

            <ScrollView contentContainerStyle={styles.listContent}>
              {selectedEvents.length === 0 ? (
                <ThemedText type="small" themeColor="textSecondary">
                  No events
                </ThemedText>
              ) : (
                selectedEvents.map((e, i) => (
                  <ThemedView key={`${e.start}-${i}`} type="backgroundElement" style={styles.eventRow}>
                    <ThemedText type="code" themeColor="textSecondary" style={styles.eventTime}>
                      {eventTimeLabel(e)}
                    </ThemedText>
                    <View style={styles.eventBody}>
                      <ThemedText type="small">{e.summary}</ThemedText>
                      {!!e.location && (
                        <ThemedText type="code" themeColor="textSecondary">
                          {e.location}
                        </ThemedText>
                      )}
                    </View>
                  </ThemedView>
                ))
              )}
            </ScrollView>
          </View>

          {/* Right: Todoist Inbox */}
          <View style={styles.tasksColumn}>
            <View style={styles.tasksHeader}>
              <ThemedText type="smallBold">Inbox</ThemedText>
              {loading ? (
                <ActivityIndicator size="small" />
              ) : (
                <ThemedText type="small" themeColor="textSecondary">
                  {open.length} open
                </ThemedText>
              )}
            </View>

            <ScrollView contentContainerStyle={styles.listContent}>
              {open.length === 0 && done.length === 0 && !loading && (
                <ThemedText type="small" themeColor="textSecondary">
                  No tasks
                </ThemedText>
              )}

              {open.map((item) => (
                <TaskRow key={item.uid} item={item} onToggle={setItemStatus} />
              ))}

              {done.length > 0 && (
                <>
                  <ThemedText
                    type="small"
                    themeColor="textSecondary"
                    style={[styles.sectionLabel, styles.doneLabel]}>
                    Completed ({done.length})
                  </ThemedText>
                  {done.map((item) => (
                    <TaskRow key={item.uid} item={item} onToggle={setItemStatus} />
                  ))}
                </>
              )}
            </ScrollView>
          </View>
        </View>
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
    gap: Spacing.two,
  },
  error: {
    color: '#e5484d',
  },
  columns: {
    flex: 1,
    flexDirection: 'row',
    gap: Spacing.four,
  },
  calendarColumn: {
    flex: 1.2,
    gap: Spacing.two,
  },
  tasksColumn: {
    flex: 1,
    gap: Spacing.two,
  },
  tasksHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 24,
  },
  sectionLabel: {
    textTransform: 'uppercase',
  },
  doneLabel: {
    marginTop: Spacing.two,
  },
  listContent: {
    gap: Spacing.two,
    paddingBottom: Spacing.four,
  },
  eventRow: {
    flexDirection: 'row',
    gap: Spacing.three,
    borderRadius: Spacing.two,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  eventTime: {
    width: 96,
  },
  eventBody: {
    flex: 1,
    gap: 2,
  },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderRadius: Spacing.two,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  checkbox: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.6,
  },
  taskText: {
    flex: 1,
    gap: 2,
  },
  completed: {
    textDecorationLine: 'line-through',
  },
  overdue: {
    color: '#e5484d',
  },
});
