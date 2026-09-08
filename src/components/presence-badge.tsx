/**
 * The little person marker shown on rooms that have an occupancy sensor.
 *
 * Blue while somebody is detected — the same cyan the pool card uses for water temperature —
 * and muted otherwise. Rooms without a sensor never render one, so an absent icon means "no
 * sensor", not "empty room".
 */
import { SymbolView } from 'expo-symbols';
import { StyleSheet, View } from 'react-native';

import { Palette } from '@/constants/styles';
import type { PresenceState } from '@/hooks/use-room-presence';

export function PresenceBadge({
  presence,
  size = 15,
  roomName,
}: {
  presence?: PresenceState;
  size?: number;
  roomName: string;
}) {
  if (!presence) return null;

  const detected = presence.available && presence.detected;

  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={
        !presence.available
          ? `${roomName} presence sensor unavailable`
          : detected
            ? `${roomName} occupied`
            : `${roomName} empty`
      }
      style={!presence.available && styles.unavailable}>
      <SymbolView
        name={{ ios: 'person.fill', android: 'person', web: 'person' }}
        tintColor={detected ? Palette.secondary : Palette.textMuted}
        size={size}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  unavailable: {
    opacity: 0.35,
  },
});
