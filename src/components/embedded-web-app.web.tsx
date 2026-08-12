import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

/**
 * react-native-webview has no web implementation, so the web target uses an iframe.
 * Note: many self-hosted apps send X-Frame-Options/frame-ancestors headers that block
 * being iframed — if this renders blank in a browser, that's why. Native is unaffected.
 */
export function EmbeddedWebApp({ uri }: { uri: string }) {
  const theme = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <iframe src={uri} style={iframeStyle} title="Embedded app" />
    </View>
  );
}

const iframeStyle = {
  border: 'none',
  width: '100%',
  height: '100%',
} as const;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
