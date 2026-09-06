import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import * as ScreenOrientation from 'expo-screen-orientation';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { StyleSheet, useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import AppSidebar from '@/components/app-sidebar';
import { HomeAssistantProvider } from '@/providers/home-assistant-provider';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();

  useEffect(() => {
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE).catch(() => {
      // Unsupported on this platform (e.g. non-fullscreen web) — ignore.
    });
  }, []);

  return (
    // Gesture handler needs this at the very root or its gestures never fire; the tab layout
    // here is expo-router/ui, which brings no navigator that would provide one.
    <GestureHandlerRootView style={styles.root}>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <AnimatedSplashOverlay />
        <HomeAssistantProvider>
          <AppSidebar />
        </HomeAssistantProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
