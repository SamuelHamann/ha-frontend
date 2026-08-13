import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import type { ConnectionStatus } from '@/hooks/use-home-assistant';
import { useTheme } from '@/hooks/use-theme';

const STATUS_MESSAGE: Record<ConnectionStatus, string> = {
  idle: 'Starting up…',
  connecting: 'Connecting to Home Assistant…',
  authenticating: 'Authenticating…',
  connected: 'Connected',
  auth_invalid: 'Home Assistant rejected the access token.',
  error: 'Lost connection to Home Assistant — retrying…',
  closed: 'Disconnected from Home Assistant.',
};

const IN_PROGRESS: ConnectionStatus[] = ['idle', 'connecting', 'authenticating'];

/**
 * Renders why a screen has no data yet. Screens must show this instead of an open-ended
 * spinner — a spinner that can never resolve reads as a hang.
 */
export function ConnectionNotice({
  status,
  error,
}: {
  status: ConnectionStatus;
  error?: string | null;
}) {
  const theme = useTheme();

  return (
    <View style={styles.wrapper}>
      <View style={styles.row}>
        {IN_PROGRESS.includes(status) && <ActivityIndicator color={theme.textSecondary} />}
        <ThemedText type="small" themeColor="textSecondary">
          {STATUS_MESSAGE[status] ?? status}
        </ThemedText>
      </View>
      {error && (
        <ThemedText type="small" style={styles.error}>
          {error}
        </ThemedText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: Spacing.one,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  error: {
    color: '#e5484d',
  },
});
