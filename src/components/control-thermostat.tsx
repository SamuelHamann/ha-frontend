/**
 * A room's thermostat: what the room is at, what it is set to, and whether it is running.
 * The setpoint is adjustable in half-degree steps, matching the unit's own granularity.
 */
import { SymbolView } from 'expo-symbols';
import { memo, useEffect, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ControlShell } from '@/components/control-shell';
import { PulseGlow } from '@/components/pulse-glow';
import { GlobalStyles, Palette, Radius, Spacing, Type } from '@/constants/styles';
import { useCallService, useDeviceEntity } from '@/hooks/use-device-entity';
import type { WatchedEntityState } from '@/hooks/use-home-assistant';
import { useOptimistic } from '@/hooks/use-optimistic';

type CallService = ReturnType<typeof useCallService>;

const STEP = 0.5;
/** Tapping repeatedly should send one setpoint, not one per press. */
const COMMIT_DELAY_MS = 500;

function round(value: number | null) {
  return value === null ? '—' : value.toFixed(1);
}

/**
 * Memoised on the entity, so nudging one room's setpoint doesn't re-render the whole modal —
 * the provider hands out a fresh context object whenever any watched device reports.
 */
const ThermostatView = memo(function ThermostatView({
  label,
  entity,
  callService,
}: {
  label: string;
  entity: WatchedEntityState | null;
  callService: CallService;
}) {
  const attributes = entity?.attributes ?? {};
  const missing = !entity || entity.state === 'unavailable';
  const heating = attributes.hvac_action === 'heating';

  const current = Number.isFinite(Number(attributes.current_temperature))
    ? Number(attributes.current_temperature)
    : null;
  const reported = Number.isFinite(Number(attributes.temperature))
    ? Number(attributes.temperature)
    : null;
  const minTemp = Number(attributes.min_temp ?? 5);
  const maxTemp = Number(attributes.max_temp ?? 30);

  // The setpoint moves the moment a button is pressed and stays there until the thermostat
  // reports the same value — so repeated taps accumulate instead of fighting a stale figure.
  const [target, requestTarget, waiting] = useOptimistic(reported ?? 0);

  const commitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** The send that the debounce is sitting on, so it can be flushed early. */
  const queued = useRef<(() => void) | null>(null);

  const flush = () => {
    if (commitTimer.current) clearTimeout(commitTimer.current);
    commitTimer.current = null;
    const send = queued.current;
    queued.current = null;
    send?.();
  };

  // Closing the modal unmounts this control. Dropping the timer here would throw away a
  // setpoint the user had already tapped in, so the pending send is fired instead of
  // cancelled — the socket lives in the provider above, and outlives this component.
  useEffect(() => () => flush(), []);

  const nudge = (delta: number) => {
    if (!entity || missing || reported === null) return;
    const next = Math.round(Math.min(Math.max(target + delta, minTemp), maxTemp) * 2) / 2;
    if (next === target) return;
    requestTarget(next);

    // Send only the value the user settled on.
    queued.current = () => {
      callService('climate', 'set_temperature', entity.entityId, { temperature: next }).catch(
        () => {
          // The override times out on its own, putting the reported setpoint back.
        },
      );
    };
    if (commitTimer.current) clearTimeout(commitTimer.current);
    commitTimer.current = setTimeout(flush, COMMIT_DELAY_MS);
  };

  return (
    <ControlShell
      label={label}
      status={missing ? 'UNAVAILABLE' : waiting ? 'SETTING…' : heating ? 'HEATING' : 'IDLE'}
      statusTone={missing ? 'warn' : heating ? 'on' : 'muted'}
    >
      {heating && <PulseGlow color={Palette.warn} />}

      <View style={styles.row}>
        <SymbolView
          name={{ ios: 'thermometer.medium', android: 'thermostat', web: 'thermostat' }}
          tintColor={heating ? Palette.warn : Palette.textMuted}
          size={18}
        />
        <View style={styles.readings}>
          <Text style={[styles.current, heating && styles.currentHeating]}>
            {round(current)}
            <Text style={Type.mono}>°C</Text>
          </Text>
          <Text style={[Type.mono, waiting && styles.pendingTarget]}>
            SET {round(reported === null ? null : target)}°C
          </Text>
        </View>

        <View style={styles.steppers}>
          <Pressable
            onPress={() => nudge(-STEP)}
            disabled={missing}
            accessibilityRole="button"
            accessibilityLabel={`${label} cooler`}
            style={({ pressed }) => [styles.stepper, pressed && GlobalStyles.pressed]}
          >
            <Text style={styles.stepperGlyph}>−</Text>
          </Pressable>
          <Pressable
            onPress={() => nudge(STEP)}
            disabled={missing}
            accessibilityRole="button"
            accessibilityLabel={`${label} warmer`}
            style={({ pressed }) => [styles.stepper, pressed && GlobalStyles.pressed]}
          >
            <Text style={styles.stepperGlyph}>+</Text>
          </Pressable>
        </View>
      </View>
    </ControlShell>
  );
});

export function ControlThermostat({ label, deviceId }: { label: string; deviceId: string }) {
  const entity = useDeviceEntity(deviceId, 'climate');
  const callService = useCallService();

  return <ThermostatView label={label} entity={entity} callService={callService} />;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  readings: {
    flex: 1,
    gap: 2,
  },
  current: {
    ...Type.monoBright,
    fontSize: 22,
    lineHeight: 26,
  },
  currentHeating: {
    color: Palette.warn,
  },
  /** The setpoint the panel is holding until the thermostat confirms it. */
  pendingTarget: {
    color: Palette.secondary,
  },
  steppers: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  stepper: {
    width: 44,
    height: 44,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Palette.border,
    backgroundColor: Palette.panelDeep,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperGlyph: {
    ...Type.monoBright,
    fontSize: 20,
    lineHeight: 24,
  },
});
