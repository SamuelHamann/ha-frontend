/**
 * A wall-switch gang or an outlet. `readOnly` shows the state but refuses to change it —
 * used for the bedroom's main power, which feeds the bedside lamps and has to stay on.
 */
import { SymbolView } from 'expo-symbols';
import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ControlShell } from '@/components/control-shell';
import { GlobalStyles, Palette, Radius, Spacing, Type } from '@/constants/styles';
import { useCallService, useDeviceEntity } from '@/hooks/use-device-entity';
import type { WatchedEntityState } from '@/hooks/use-home-assistant';
import { useOptimistic } from '@/hooks/use-optimistic';

type CallService = ReturnType<typeof useCallService>;

/**
 * Memoised on the entity: the provider hands out a fresh context object on every update, and
 * the power meter alone reports every few seconds — without this, touching one control would
 * re-render every other one in the modal.
 */
const SwitchView = memo(function SwitchView({
  label,
  entity,
  readOnly,
  outlet,
  callService,
}: {
  label: string;
  entity: WatchedEntityState | null;
  readOnly?: boolean;
  outlet?: boolean;
  callService: CallService;
}) {
  const missing = !entity || entity.state === 'unavailable';
  const [on, requestOn, waiting] = useOptimistic(entity?.state === 'on');
  const locked = !!readOnly || missing;

  const toggle = () => {
    if (locked || !entity) return;
    // Flip immediately; the entity update confirms it a moment later.
    requestOn(!on);
    callService(entity.entityId.split('.')[0], 'toggle', entity.entityId).catch(() => {
      // The override times out on its own, putting the true state back on screen.
    });
  };

  return (
    <ControlShell
      label={label}
      status={readOnly ? 'LOCKED ON' : missing ? 'UNAVAILABLE' : on ? 'ON' : 'OFF'}
      statusTone={missing ? 'warn' : on ? 'on' : 'muted'}>
      <View style={styles.row}>
        <SymbolView
          name={
            outlet
              ? { ios: 'powerplug.fill', android: 'power', web: 'power' }
              : { ios: 'lightbulb.fill', android: 'lightbulb', web: 'lightbulb' }
          }
          tintColor={on ? Palette.warn : Palette.textMuted}
          size={18}
        />
        <Text style={[Type.body, styles.entity]} numberOfLines={1}>
          {entity?.name ?? entity?.entityId ?? 'Not found'}
        </Text>

        <Pressable
          onPress={toggle}
          disabled={locked}
          accessibilityRole="switch"
          accessibilityState={{ checked: on, disabled: locked }}
          accessibilityLabel={label}
          style={({ pressed }) => [
            styles.toggle,
            on && styles.toggleOn,
            locked && styles.toggleLocked,
            // Waiting dims the button rather than replacing its label with a spinner, so
            // nothing on the row moves while the command is in flight.
            waiting && styles.waiting,
            pressed && GlobalStyles.pressed,
          ]}>
          <Text style={[Type.label, on && styles.toggleTextOn]}>
            {readOnly ? 'LOCKED' : on ? 'TURN OFF' : 'TURN ON'}
          </Text>
        </Pressable>
      </View>
    </ControlShell>
  );
});

export function ControlSwitch({
  label,
  deviceId,
  gang = 0,
  readOnly,
  outlet,
}: {
  label: string;
  deviceId: string;
  gang?: number;
  readOnly?: boolean;
  outlet?: boolean;
}) {
  const entity = useDeviceEntity(deviceId, 'light,switch', gang);
  const callService = useCallService();

  return (
    <SwitchView
      label={label}
      entity={entity}
      readOnly={readOnly}
      outlet={outlet}
      callService={callService}
    />
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  entity: {
    flex: 1,
  },
  toggle: {
    minWidth: 92,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Palette.border,
    backgroundColor: Palette.panelDeep,
  },
  toggleOn: {
    borderColor: Palette.warn,
  },
  toggleTextOn: {
    color: Palette.warn,
  },
  toggleLocked: {
    opacity: 0.45,
  },
  waiting: {
    opacity: 0.7,
  },
});
