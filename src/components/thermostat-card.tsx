/**
 * One room's thermostat, as a full-width row. While the unit is actually calling for heat a
 * warm glow pulses behind it — the only motion on the panel, so an active radiator reads at
 * a glance.
 */
import { useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { AnchorRect } from '@/components/modal-sheet';
import { PulseGlow } from '@/components/pulse-glow';
import { GlobalStyles, Palette, Radius, Spacing, Type } from '@/constants/styles';
import type { Thermostat } from '@/hooks/use-thermostats';

function round(value: number | null) {
  return value === null ? '—' : value.toFixed(1);
}

export function ThermostatCard({
  thermostat,
  onOpen,
}: {
  thermostat: Thermostat;
  onOpen: (thermostat: Thermostat, anchor: AnchorRect) => void;
}) {
  const { name, current, heating, off } = thermostat;
  const ref = useRef<View>(null);

  // Measured on press rather than from onLayout: the popover needs screen coordinates, and
  // the card sits inside several nested columns.
  const open = () => {
    ref.current?.measureInWindow((x, y, width, height) =>
      onOpen(thermostat, { x, y, width, height }),
    );
  };

  return (
    <Pressable
      ref={ref}
      onPress={open}
      accessibilityRole="button"
      accessibilityLabel={`${name} thermostat`}
      style={({ pressed }) => [
        GlobalStyles.tile,
        styles.card,
        heating && styles.cardHeating,
        pressed && GlobalStyles.pressed,
      ]}
    >
      {/* Rendered first so it sits behind the text. */}
      {heating && <PulseGlow color={Palette.warn} />}

      <View style={[GlobalStyles.led, heating && styles.ledHeating]} />
      <Text style={[styles.name, off && styles.nameOff]} numberOfLines={1}>
        {name.toUpperCase()}
      </Text>

      <Text style={[styles.temperature, heating && styles.temperatureHeating]}>
        {round(current)}
        <Text style={Type.mono}>°C</Text>
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderRadius: Radius.sm,
    // Uniform height across the stack, whatever a row happens to contain.
    height: 42,
    // Keeps the glow inside the card's corners.
    overflow: 'hidden',
  },
  cardHeating: {
    borderColor: Palette.warn,
  },
  ledHeating: {
    backgroundColor: Palette.warn,
  },
  name: {
    ...Type.body,
    flex: 1,
    letterSpacing: 0.8,
  },
  nameOff: {
    color: Palette.textMuted,
  },
  temperature: {
    ...Type.monoBright,
    fontSize: 18,
    lineHeight: 22,
    // Fixed width so every reading lines up down the column.
    width: 68,
    textAlign: 'right',
  },
  temperatureHeating: {
    color: Palette.warn,
  },
});
