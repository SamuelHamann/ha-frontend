import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useNotifications } from '@/hooks/use-notifications';
import { useTheme } from '@/hooks/use-theme';

const ALERT_COLOR = '#e5484d';

export function NotificationBell() {
  const theme = useTheme();
  const { notifications, count } = useNotifications();
  const [open, setOpen] = useState(false);
  const hasAlerts = count > 0;

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={hasAlerts ? `Notifications, ${count} unread` : 'Notifications'}
        style={({ pressed }) => [styles.bellButton, pressed && styles.pressed]}>
        <SymbolView
          name={{
            ios: hasAlerts ? 'bell.fill' : 'bell',
            android: 'notifications',
            web: 'notifications',
          }}
          tintColor={hasAlerts ? ALERT_COLOR : theme.textSecondary}
          size={24}
        />
        {hasAlerts && (
          <View style={styles.badge}>
            <ThemedText type="small" style={styles.badgeText}>
              {count > 9 ? '9+' : count}
            </ThemedText>
          </View>
        )}
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
        supportedOrientations={['landscape', 'landscape-left', 'landscape-right']}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          {/* Stop presses inside the panel from closing it via the backdrop. */}
          <Pressable onPress={(e) => e.stopPropagation()}>
            <ThemedView type="backgroundElement" style={styles.panel}>
              <ThemedText type="smallBold">Notifications</ThemedText>
              {notifications.length === 0 ? (
                <ThemedText type="small" themeColor="textSecondary">
                  No notifications
                </ThemedText>
              ) : (
                notifications.map((n) => (
                  <View key={n.id} style={styles.notificationRow}>
                    <ThemedText type="small">{n.title}</ThemedText>
                    {n.detail && (
                      <ThemedText type="code" themeColor="textSecondary">
                        {n.detail}
                      </ThemedText>
                    )}
                  </View>
                ))
              )}
            </ThemedView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  bellButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.6,
  },
  badge: {
    position: 'absolute',
    top: 2,
    right: 2,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 3,
    borderRadius: 8,
    backgroundColor: ALERT_COLOR,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontSize: 10,
    lineHeight: 12,
    color: '#ffffff',
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'flex-end',
    paddingTop: Spacing.six,
    paddingRight: Spacing.four,
  },
  panel: {
    minWidth: 280,
    maxWidth: 380,
    borderRadius: Spacing.three,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  notificationRow: {
    gap: 2,
  },
});
