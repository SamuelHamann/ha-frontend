import { usePathname } from 'expo-router';
import { Tabs, TabList, TabSlot, TabTrigger, type TabTriggerSlotProps } from 'expo-router/ui';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { NotificationBell } from '@/components/notification-bell';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** Routes that render edge-to-edge: no top bar, so the page gets the full content area. */
const FULL_BLEED_ROUTES = new Set(['/food']);

type SidebarIconButtonProps = TabTriggerSlotProps & {
  icon: SymbolViewProps['name'];
  accessibilityLabel: string;
};

function SidebarIconButton({ icon, accessibilityLabel, isFocused, style, ...props }: SidebarIconButtonProps) {
  const theme = useTheme();
  return (
    <Pressable
      {...props}
      accessibilityRole="tab"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected: !!isFocused }}
      style={[styles.iconButton, isFocused && { backgroundColor: theme.backgroundSelected }]}>
      <SymbolView name={icon} tintColor={isFocused ? theme.text : theme.textSecondary} size={26} />
    </Pressable>
  );
}

export default function AppSidebar() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const pathname = usePathname();
  const fullBleed = FULL_BLEED_ROUTES.has(pathname);

  return (
    <Tabs style={styles.root}>
      <TabList
        style={[
          styles.sidebar,
          {
            paddingTop: insets.top + Spacing.three,
            paddingBottom: insets.bottom + Spacing.three,
            paddingLeft: insets.left,
            backgroundColor: theme.backgroundElement,
          },
        ]}>
        <TabTrigger name="floorplans" href="/" asChild>
          <SidebarIconButton
            accessibilityLabel="Floorplans"
            icon={{ ios: 'square.grid.2x2', android: 'grid_view', web: 'grid_view' }}
          />
        </TabTrigger>
        <TabTrigger name="weather" href="/weather" asChild>
          <SidebarIconButton
            accessibilityLabel="Weather"
            icon={{ ios: 'cloud.sun', android: 'partly_cloudy_day', web: 'partly_cloudy_day' }}
          />
        </TabTrigger>
        <TabTrigger name="tasks" href="/tasks" asChild>
          <SidebarIconButton
            accessibilityLabel="Tasks and calendar"
            icon={{ ios: 'calendar', android: 'calendar_month', web: 'calendar_month' }}
          />
        </TabTrigger>
        <TabTrigger name="food" href="/food" asChild>
          <SidebarIconButton
            accessibilityLabel="Food"
            icon={{ ios: 'fork.knife', android: 'restaurant', web: 'restaurant' }}
          />
        </TabTrigger>
        <TabTrigger name="scenes" href="/scenes" asChild>
          <SidebarIconButton
            accessibilityLabel="Scenes"
            icon={{ ios: 'sparkles', android: 'auto_awesome', web: 'auto_awesome' }}
          />
        </TabTrigger>
        <TabTrigger name="technicals" href="/technicals" asChild>
          <SidebarIconButton
            accessibilityLabel="Technicals"
            icon={{ ios: 'gearshape', android: 'settings', web: 'settings' }}
          />
        </TabTrigger>
      </TabList>

      <View style={styles.content}>
        {!fullBleed && (
          <View
            style={[
              styles.topBar,
              { paddingTop: insets.top + Spacing.two, paddingRight: insets.right + Spacing.three },
            ]}>
            <NotificationBell />
          </View>
        )}
        <TabSlot style={styles.slot} />
      </View>
    </Tabs>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    flexDirection: 'row',
  },
  sidebar: {
    width: 88,
    // TabList defaults to row + space-between; both must be overridden for a vertical rail.
    flexDirection: 'column',
    justifyContent: 'flex-start',
    alignItems: 'center',
    gap: Spacing.three,
  },
  content: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.two,
  },
  slot: {
    flex: 1,
  },
  iconButton: {
    width: 56,
    height: 56,
    borderRadius: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
