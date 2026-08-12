import { FlatList, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { HA_HTTP_URL } from '@/constants/ha-config';
import { Spacing } from '@/constants/theme';
import { WatchedDeviceState } from '@/hooks/use-home-assistant';
import { useHomeAssistantContext } from '@/providers/home-assistant-provider';

const STATUS_COLOR: Record<string, string> = {
  idle: '#808080',
  connecting: '#d9a441',
  authenticating: '#d9a441',
  connected: '#3ecf5f',
  auth_invalid: '#e5484d',
  error: '#e5484d',
  closed: '#808080',
};

function formatTime(ts: number | null) {
  if (!ts) return '—';
  return new Date(ts).toLocaleTimeString([], { hour12: false });
}

function DeviceCard({ device }: { device: WatchedDeviceState }) {
  return (
    <ThemedView type="backgroundElement" style={styles.deviceCard}>
      <ThemedText type="smallBold">{device.label ?? device.id}</ThemedText>
      <ThemedText type="code" themeColor="textSecondary">
        {device.id}
      </ThemedText>
      {device.entities.length === 0 ? (
        <ThemedText type="small" themeColor="textSecondary">
          Resolving entities…
        </ThemedText>
      ) : (
        device.entities.map((e) => (
          <View key={e.entityId} style={styles.entityRow}>
            <ThemedText type="small" style={styles.entityName}>
              {e.name ?? e.entityId}
            </ThemedText>
            <ThemedText type="code">{e.state ?? '—'}</ThemedText>
          </View>
        ))
      )}
    </ThemedView>
  );
}

export default function TechnicalsScreen() {
  const { status, haVersion, error, devices, events } = useHomeAssistantContext();

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['bottom', 'left', 'right']}>
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <View style={[styles.statusDot, { backgroundColor: STATUS_COLOR[status] ?? '#808080' }]} />
            <ThemedText type="small" themeColor="textSecondary">
              {HA_HTTP_URL || 'no server url set'}
              {haVersion ? ` · HA ${haVersion}` : ''}
            </ThemedText>
          </View>
          {error && (
            <ThemedText type="small" style={styles.error}>
              {error}
            </ThemedText>
          )}
        </View>

        <View style={styles.body}>
          <View style={styles.devicesColumn}>
            <ThemedText type="small" themeColor="textSecondary" style={styles.sectionLabel}>
              Watched devices ({devices.length})
            </ThemedText>
            <FlatList
              data={devices}
              keyExtractor={(d) => d.id}
              renderItem={({ item }) => <DeviceCard device={item} />}
              contentContainerStyle={styles.devicesList}
            />
          </View>

          <View style={styles.eventsColumn}>
            <ThemedText type="small" themeColor="textSecondary" style={styles.sectionLabel}>
              Live events ({events.length})
            </ThemedText>
            <FlatList
              style={styles.list}
              contentContainerStyle={styles.listContent}
              data={events}
              keyExtractor={(item) => String(item.key)}
              renderItem={({ item }) => (
                <ThemedView type="backgroundElement" style={styles.eventRow}>
                  <ThemedText type="small" style={styles.eventTime}>
                    {formatTime(item.receivedAt)}
                  </ThemedText>
                  <View style={styles.eventBody}>
                    <ThemedText type="smallBold">{item.friendlyName ?? item.entityId}</ThemedText>
                    <ThemedText type="code">
                      {item.entityId}: {item.oldState ?? '—'} → {item.newState ?? '—'}
                    </ThemedText>
                  </View>
                </ThemedView>
              )}
              ListEmptyComponent={
                <ThemedText type="small" themeColor="textSecondary">
                  Waiting for state_changed events from watched devices…
                </ThemedText>
              }
            />
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
    paddingTop: Spacing.two,
    gap: Spacing.three,
  },
  header: {
    gap: Spacing.half,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  error: {
    color: '#e5484d',
  },
  body: {
    flex: 1,
    flexDirection: 'row',
    gap: Spacing.four,
  },
  devicesColumn: {
    flex: 1,
    gap: Spacing.two,
  },
  eventsColumn: {
    flex: 1,
    gap: Spacing.two,
  },
  sectionLabel: {
    textTransform: 'uppercase',
  },
  devicesList: {
    gap: Spacing.two,
    paddingBottom: Spacing.four,
  },
  deviceCard: {
    borderRadius: Spacing.two,
    padding: Spacing.three,
    gap: Spacing.half,
  },
  entityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  entityName: {
    flexShrink: 1,
  },
  list: {
    flex: 1,
  },
  listContent: {
    gap: Spacing.two,
    paddingBottom: Spacing.four,
  },
  eventRow: {
    flexDirection: 'row',
    gap: Spacing.three,
    padding: Spacing.two,
    borderRadius: Spacing.two,
    alignItems: 'center',
  },
  eventTime: {
    minWidth: 70,
  },
  eventBody: {
    flex: 1,
    gap: 2,
  },
});
