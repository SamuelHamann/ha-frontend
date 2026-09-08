/**
 * A colour bulb: on/off, intensity, colour temperature and a row of preset colours.
 *
 * Presets stand in for a colour wheel on purpose — this is a wall panel, and picking a hue
 * by dragging on a small target is worse than tapping the shade you actually want.
 */
import { SymbolView } from 'expo-symbols';
import { memo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ColourPickerModal, type Rgb } from '@/components/colour-picker-modal';
import { ControlShell } from '@/components/control-shell';
import { Slider } from '@/components/slider';
import { GlobalStyles, Palette, Radius, Spacing, Type } from '@/constants/styles';
import { useCallService, useDeviceEntity } from '@/hooks/use-device-entity';
import type { WatchedEntityState } from '@/hooks/use-home-assistant';
import { useOptimistic } from '@/hooks/use-optimistic';

type CallService = ReturnType<typeof useCallService>;

/** HA reports brightness on 0–255; the panel shows percent. */
const MAX_BRIGHTNESS = 255;

const COLOURS: { name: string; rgb: [number, number, number] }[] = [
  { name: 'Warm', rgb: [255, 170, 90] },
  { name: 'Peach', rgb: [255, 120, 80] },
  { name: 'Red', rgb: [255, 40, 60] },
  { name: 'Pink', rgb: [255, 60, 158] },
  { name: 'Violet', rgb: [150, 80, 255] },
  { name: 'Blue', rgb: [45, 120, 255] },
  { name: 'Cyan', rgb: [45, 226, 230] },
  { name: 'Green', rgb: [70, 220, 120] },
];

/**
 * Memoised on the entity, so adjusting one bulb doesn't re-render the rest of the modal —
 * the provider hands out a fresh context object whenever any watched device reports.
 */
const BulbView = memo(function BulbView({
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

  const minKelvin = Number(attributes.min_color_temp_kelvin ?? 2200);
  const maxKelvin = Number(attributes.max_color_temp_kelvin ?? 6500);

  // Each control shows what was asked for until the bulb reports it, so a drag or a tap
  // lands instantly instead of snapping back for a beat.
  const [on, requestOn, waitingOn] = useOptimistic(entity?.state === 'on');
  const [brightness, requestBrightness] = useOptimistic(Number(attributes.brightness ?? 0));
  const [kelvin, requestKelvin] = useOptimistic(
    Number(attributes.color_temp_kelvin ?? Math.round((minKelvin + maxKelvin) / 2)),
  );
  const [pickerOpen, setPickerOpen] = useState(false);

  const currentRgb = Array.isArray(attributes.rgb_color)
    ? (attributes.rgb_color.slice(0, 3) as Rgb)
    : null;

  const apply = (service: string, data?: Record<string, unknown>) => {
    if (!entity || missing) return;
    callService('light', service, entity.entityId, data).catch(() => {
      // The overrides time out on their own, putting the true state back on screen.
    });
  };

  return (
    <ControlShell
      label={label}
      status={
        missing
          ? 'UNAVAILABLE'
          : on
            ? `ON · ${Math.round((brightness / MAX_BRIGHTNESS) * 100)}%`
            : 'OFF'
      }
      statusTone={missing ? 'warn' : on ? 'on' : 'muted'}
    >
      <View style={styles.header}>
        <SymbolView
          name={{ ios: 'lightbulb.fill', android: 'lightbulb', web: 'lightbulb' }}
          tintColor={on ? Palette.warn : Palette.textMuted}
          size={18}
        />
        <Text style={[Type.body, styles.entity]} numberOfLines={1}>
          {entity?.name ?? entity?.entityId ?? 'Not found'}
        </Text>
        <Pressable
          onPress={() => {
            requestOn(!on);
            apply('toggle');
          }}
          disabled={missing}
          accessibilityRole="switch"
          accessibilityState={{ checked: on }}
          accessibilityLabel={`${label} power`}
          style={({ pressed }) => [
            styles.toggle,
            on && styles.toggleOn,
            missing && styles.disabled,
            // Dimmed while in flight rather than swapped for a spinner, so the row holds
            // its shape.
            waitingOn && styles.waiting,
            pressed && GlobalStyles.pressed,
          ]}
        >
          <Text style={[Type.label, on && styles.toggleTextOn]}>{on ? 'TURN OFF' : 'TURN ON'}</Text>
        </Pressable>
      </View>

      <View style={styles.field}>
        <View style={GlobalStyles.spread}>
          <Text style={Type.label}>INTENSITY</Text>
          <Text style={Type.mono}>{Math.round((brightness / MAX_BRIGHTNESS) * 100)}%</Text>
        </View>
        <Slider
          value={brightness}
          min={1}
          max={MAX_BRIGHTNESS}
          color={Palette.warn}
          disabled={missing}
          // turn_on with a brightness also switches the bulb on, which is what dragging
          // a dark bulb's slider is asking for.
          onCommit={(next) => {
            requestBrightness(next);
            requestOn(true);
            apply('turn_on', { brightness: next });
          }}
        />
      </View>

      <View style={styles.field}>
        <View style={GlobalStyles.spread}>
          <Text style={Type.label}>TEMPERATURE</Text>
          <Text style={Type.mono}>{kelvin}K</Text>
        </View>
        <Slider
          value={kelvin}
          min={minKelvin}
          max={maxKelvin}
          color={Palette.secondary}
          disabled={missing}
          onCommit={(next) => {
            requestKelvin(next);
            apply('turn_on', { color_temp_kelvin: next });
          }}
        />
      </View>

      <View style={styles.field}>
        <View style={GlobalStyles.spread}>
          <Text style={Type.label}>COLOUR</Text>
          <Pressable
            onPress={() => setPickerOpen(true)}
            disabled={missing}
            accessibilityRole="button"
            accessibilityLabel={`${label} colour picker`}
            style={({ pressed }) => [
              styles.pick,
              missing && styles.disabled,
              pressed && GlobalStyles.pressed,
            ]}
          >
            <SymbolView
              name={{ ios: 'paintpalette.fill', android: 'palette', web: 'palette' }}
              tintColor={Palette.primary}
              size={14}
            />
            <Text style={[Type.label, styles.pickText]}>MORE</Text>
          </Pressable>
        </View>
        <View style={styles.swatches}>
          {COLOURS.map((colour) => (
            <Pressable
              key={colour.name}
              onPress={() => {
                requestOn(true);
                apply('turn_on', { rgb_color: colour.rgb });
              }}
              disabled={missing}
              accessibilityRole="button"
              accessibilityLabel={`${label} ${colour.name}`}
              style={({ pressed }) => [
                styles.swatch,
                { backgroundColor: `rgb(${colour.rgb.join(',')})` },
                missing && styles.disabled,
                pressed && GlobalStyles.pressed,
              ]}
            />
          ))}
        </View>
      </View>

      <ColourPickerModal
        visible={pickerOpen}
        title={label}
        initial={currentRgb}
        onPick={(rgb) => {
          requestOn(true);
          apply('turn_on', { rgb_color: rgb });
        }}
        onClose={() => setPickerOpen(false)}
      />
    </ControlShell>
  );
});

export function ControlBulb({ label, deviceId }: { label: string; deviceId: string }) {
  const entity = useDeviceEntity(deviceId, 'light');
  const callService = useCallService();

  return <BulbView label={label} entity={entity} callService={callService} />;
}

const styles = StyleSheet.create({
  header: {
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
  field: {
    gap: 2,
  },
  swatches: {
    flexDirection: 'row',
    gap: Spacing.two,
    paddingTop: Spacing.one,
  },
  swatch: {
    flex: 1,
    height: 30,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Palette.border,
  },
  disabled: {
    opacity: 0.4,
  },
  waiting: {
    opacity: 0.7,
  },
  pick: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.two,
    paddingVertical: 3,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Palette.primary,
  },
  pickText: {
    color: Palette.primary,
  },
});
