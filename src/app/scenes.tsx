import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CollapsibleSection } from '@/components/collapsible-section';
import { ConnectionNotice } from '@/components/connection-notice';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useScenes, type Scene } from '@/hooks/use-scenes';
import { useTheme } from '@/hooks/use-theme';
import { useHomeAssistantContext } from '@/providers/home-assistant-provider';

function formatLastActivated(iso: string | null) {
  if (!iso) return 'Never activated';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'Never activated';
  return `Last used ${d.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })}`;
}

function SceneRow({
  scene,
  onActivate,
}: {
  scene: Scene;
  onActivate: (entityId: string) => Promise<void>;
}) {
  const theme = useTheme();
  const [running, setRunning] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  const run = async () => {
    if (running) return;
    setRunning(true);
    setFailed(null);
    try {
      await onActivate(scene.entityId);
    } catch (e) {
      setFailed(e instanceof Error ? e.message : 'Failed to run scene');
    } finally {
      setRunning(false);
    }
  };

  return (
    <ThemedView type="backgroundElement" style={styles.sceneRow}>
      <SymbolView
        name={{ ios: 'theatermasks', android: 'theater_comedy', web: 'theater_comedy' }}
        tintColor={theme.textSecondary}
        size={20}
      />
      <View style={styles.sceneText}>
        <ThemedText type="small">{scene.name}</ThemedText>
        <ThemedText type="code" themeColor={failed ? 'text' : 'textSecondary'} style={failed && styles.error}>
          {failed ?? formatLastActivated(scene.lastActivated)}
        </ThemedText>
      </View>

      <Pressable
        onPress={run}
        disabled={running}
        accessibilityRole="button"
        accessibilityLabel={`Run scene ${scene.name}`}
        hitSlop={8}
        style={({ pressed }) => [
          styles.playButton,
          { backgroundColor: theme.backgroundSelected },
          pressed && styles.pressed,
        ]}>
        {running ? (
          <ActivityIndicator size="small" color={theme.text} />
        ) : (
          <SymbolView
            name={{ ios: 'play.fill', android: 'play_arrow', web: 'play_arrow' }}
            tintColor={theme.text}
            size={18}
          />
        )}
      </Pressable>
    </ThemedView>
  );
}

export default function ScenesScreen() {
  const { groups, loading, error, connected, activateScene } = useScenes();
  const { status, error: connectionError } = useHomeAssistantContext();
  const theme = useTheme();
  const total = groups.reduce((n, g) => n + g.scenes.length, 0);

  // Until the socket is up there is nothing to fetch; say so rather than spinning forever.
  if (!connected) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea} edges={['bottom', 'left', 'right']}>
          <ThemedText type="subtitle">Scenes</ThemedText>
          <ConnectionNotice status={status} error={connectionError} />
        </SafeAreaView>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['bottom', 'left', 'right']}>
        <View style={styles.header}>
          <ThemedText type="subtitle">Scenes</ThemedText>
          {!loading && !error && (
            <ThemedText type="small" themeColor="textSecondary">
              {total} scene{total === 1 ? '' : 's'} across {groups.length} location
              {groups.length === 1 ? '' : 's'}
            </ThemedText>
          )}
        </View>

        {loading && <ActivityIndicator color={theme.textSecondary} style={styles.loader} />}

        {error && (
          <ThemedText type="small" style={styles.error}>
            {error}
          </ThemedText>
        )}

        {!loading && !error && groups.length === 0 && (
          <ThemedText type="small" themeColor="textSecondary">
            No scenes found on this Home Assistant instance.
          </ThemedText>
        )}

        <ScrollView contentContainerStyle={styles.scrollContent}>
          {groups.map((group) => (
            <CollapsibleSection
              key={group.areaId ?? 'unassigned'}
              title={group.areaName}
              badge={group.scenes.length}>
              {group.scenes.map((scene) => (
                <SceneRow key={scene.entityId} scene={scene} onActivate={activateScene} />
              ))}
            </CollapsibleSection>
          ))}
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
    gap: Spacing.three,
  },
  header: {
    gap: Spacing.half,
  },
  loader: {
    alignSelf: 'flex-start',
  },
  error: {
    color: '#e5484d',
  },
  scrollContent: {
    gap: Spacing.two,
    paddingBottom: Spacing.five,
  },
  sceneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderRadius: Spacing.two,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  sceneText: {
    flex: 1,
    gap: 2,
  },
  playButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.6,
  },
});
