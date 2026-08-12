/**
 * Web apps embedded into pages via WebView. Not secret, so this file is git-tracked.
 *
 * Note: plain-http URLs need `android.usesCleartextTraffic` in app.json's
 * expo-build-properties plugin (already enabled) to load outside Expo Go.
 */
export const EMBEDDED_APPS = {
  /** Grocy — groceries & household management. */
  food: 'http://192.168.2.50:9283',
} as const;
