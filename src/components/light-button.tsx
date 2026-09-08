/**
 * The light control on a room card: a bulb that glows and pulses while the light is on.
 *
 * A room with nothing wired up still gets a button, rendered dead — the grid stays regular,
 * and it is obvious which rooms are not controllable yet.
 */
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet } from 'react-native';

import { PulseGlow } from '@/components/pulse-glow';
import { GlobalStyles, Palette, Radius } from '@/constants/styles';

export function LightButton({
  on,
  roomName,
  disabled,
  onToggle,
}: {
  on: boolean;
  roomName: string;
  disabled: boolean;
  onToggle: () => Promise<void>;
}) {
  const [pending, setPending] = useState(false);

  const press = async () => {
    if (pending) return;
    setPending(true);
    try {
      await onToggle();
    } catch {
      // The button reflects entity state, so a failure simply leaves it where it was.
    } finally {
      setPending(false);
    }
  };

  const tint = disabled ? Palette.border : on ? Palette.warn : Palette.textMuted;

  return (
    <Pressable
      onPress={press}
      disabled={disabled || pending}
      accessibilityRole="switch"
      accessibilityState={{ checked: on, disabled }}
      accessibilityLabel={`${roomName} light`}
      style={({ pressed }) => [
        styles.button,
        on && styles.buttonOn,
        disabled && styles.buttonDisabled,
        pressed && GlobalStyles.pressed,
      ]}>
      {/* Rendered first so the glow sits behind the bulb. */}
      {on && <PulseGlow color={Palette.warn} />}
      {pending ? (
        <ActivityIndicator size="small" color={Palette.textMuted} />
      ) : (
        <SymbolView
          name={{ ios: 'lightbulb.fill', android: 'lightbulb', web: 'lightbulb' }}
          tintColor={tint}
          size={20}
        />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 42,
    height: 42,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Palette.border,
    backgroundColor: Palette.panelDeep,
    alignItems: 'center',
    justifyContent: 'center',
    // Keeps the glow inside the button's corners.
    overflow: 'hidden',
  },
  buttonOn: {
    borderColor: Palette.warn,
  },
  buttonDisabled: {
    opacity: 0.45,
  },
});
