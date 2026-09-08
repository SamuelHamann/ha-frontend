/**
 * One room on the Home page: what it is, and its main light.
 */
import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { LightButton } from '@/components/light-button';
import { GlobalStyles, Palette, Radius, Spacing, Type } from '@/constants/styles';
import type { Room } from '@/config/home';
import type { RoomLightState } from '@/hooks/use-room-lights';

export function RoomCard({
  room,
  light,
  onToggle,
  onOpen,
  fullWidth,
}: {
  room: Room;
  light: RoomLightState;
  onToggle: (entityId: string) => Promise<void>;
  onOpen: (room: Room) => void;
  fullWidth?: boolean;
}) {
  const controllable = !!light.entityId && !light.unavailable;

  return (
    <Pressable
      onPress={() => onOpen(room)}
      accessibilityRole="button"
      accessibilityLabel={`${room.name} devices`}
      style={({ pressed }) => [
        GlobalStyles.tile,
        styles.card,
        fullWidth ? styles.cardFull : styles.cardHalf,
        light.on && styles.cardOn,
        pressed && GlobalStyles.pressed,
      ]}>
      <View style={styles.iconChip}>
        <SymbolView
          name={room.icon}
          tintColor={light.on ? Palette.warn : Palette.textMuted}
          size={20}
        />
      </View>

      <View style={styles.text}>
        <Text style={styles.name} numberOfLines={1}>
          {room.name.toUpperCase()}
        </Text>
        <Text style={Type.mono}>
          {!light.entityId ? 'NO LIGHT' : light.unavailable ? 'UNAVAILABLE' : light.on ? 'ON' : 'OFF'}
        </Text>
      </View>

      <LightButton
        on={light.on}
        roomName={room.name}
        disabled={!controllable}
        onToggle={() => onToggle(light.entityId!)}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderRadius: Radius.sm,
    height: 72,
  },
  /** Two per row: the pair plus the gap has to stay inside the column. */
  cardHalf: {
    width: '48%',
    flexGrow: 1,
  },
  cardFull: {
    width: '100%',
  },
  cardOn: {
    borderColor: Palette.warn,
  },
  iconChip: {
    width: 38,
    height: 38,
    borderRadius: Radius.sm,
    backgroundColor: Palette.panelDeep,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    flex: 1,
    gap: 2,
  },
  name: {
    ...Type.body,
    letterSpacing: 0.8,
  },
});
