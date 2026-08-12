import { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export function EmbeddedWebApp({ uri }: { uri: string }) {
  const theme = useTheme();
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState<string | null>(null);

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <WebView
        source={{ uri }}
        style={styles.webview}
        // Grocy keeps its session in a cookie; without this the login doesn't persist.
        sharedCookiesEnabled
        thirdPartyCookiesEnabled
        domStorageEnabled
        javaScriptEnabled
        onLoadEnd={() => setLoading(false)}
        onError={({ nativeEvent }) => {
          setLoading(false);
          setFailed(nativeEvent.description ?? 'Failed to load');
        }}
      />
      {loading && !failed && (
        <View style={[styles.overlay, { backgroundColor: theme.background }]}>
          <ActivityIndicator color={theme.textSecondary} />
        </View>
      )}
      {failed && (
        <View style={[styles.overlay, { backgroundColor: theme.background }]}>
          <ThemedText type="smallBold">Couldn&apos;t load {uri}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {failed}
          </ThemedText>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  webview: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
    padding: Spacing.four,
  },
});
