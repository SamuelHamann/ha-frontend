/**
 * One room's thermostat, as a full-width row. While the unit is actually calling for heat a
 * warm glow pulses behind it — the only motion on the panel, so an active radiator reads at
 * a glance.
 */
import { StyleSheet, Text, View } from 'react-native';

import { PulseGlow } from '@/components/pulse-glow';
import { GlobalStyles, Palette, Radius, Spacing, Type } from '@/constants/styles';
import type { Thermostat } from '@/hooks/use-thermostats';

function round(value: number | null) {
  return value === null ? '—' : value.toFixed(1);
}

export function ThermostatCard({ thermostat }: { thermostat: Thermostat }) {
  const { name, current, heating, off } = thermostat;

  return (
    <View style={[GlobalStyles.tile, styles.card, heating && styles.cardHeating]}>
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
    </View>
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
