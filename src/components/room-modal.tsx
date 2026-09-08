/**
 * A room's devices, in the shared modal shell. The room's `controls` list decides what
 * appears — this only maps each entry to its control component.
 */
import { StyleSheet, Text, View } from 'react-native';

import { ControlBulb } from '@/components/control-bulb';
import { ControlHistory } from '@/components/control-history';
import { ControlSwitch } from '@/components/control-switch';
import { ControlThermostat } from '@/components/control-thermostat';
import { ModalSheet } from '@/components/modal-sheet';
import { DEVICE_IDS } from '@/config/devices';
import { POOL_PUMP_SWITCH_SUFFIX, type Room, type RoomControl } from '@/config/home';
import { Palette, Spacing, Type } from '@/constants/styles';

/** The pump is the outlet named by POOL_PUMP_SWITCH_SUFFIX — gang 0 of the two-outlet plug. */
const POOL_PUMP_GANG = Number(POOL_PUMP_SWITCH_SUFFIX.slice(-1)) - 1;

function Control({ control }: { control: RoomControl }) {
  switch (control.kind) {
    case 'switch':
      return (
        <ControlSwitch
          label={control.label}
          deviceId={control.deviceId}
          gang={control.gang}
          readOnly={control.readOnly}
        />
      );
    case 'outlet':
      return (
        <ControlSwitch
          label={control.label}
          deviceId={control.deviceId}
          gang={control.gang ?? 0}
          outlet
        />
      );
    case 'bulb':
      return <ControlBulb label={control.label} deviceId={control.deviceId} />;
    case 'thermostat':
      return <ControlThermostat label={control.label} deviceId={control.deviceId} />;
    case 'poolPump':
      return (
        <ControlSwitch
          label={control.label}
          deviceId={DEVICE_IDS.poolPlug}
          gang={POOL_PUMP_GANG}
          outlet
        />
      );
    case 'history':
      return (
        <ControlHistory
          label={control.label}
          deviceId={control.deviceId}
          deviceClass={control.deviceClass}
          hours={control.hours}
        />
      );
  }
}

export function RoomModal({
  room,
  visible,
  onClose,
}: {
  room: Room | null;
  visible: boolean;
  onClose: () => void;
}) {
  if (!room) return null;

  const count = room.controls.length;

  return (
    <ModalSheet
      visible={visible}
      title={room.name}
      subtitle={count === 0 ? 'Nothing connected yet' : `${count} device${count === 1 ? '' : 's'}`}
      icon={room.icon}
      onClose={onClose}>
      {count === 0 ? (
        <View style={styles.empty}>
          <Text style={Type.bodyMuted}>
            No devices are wired up in here yet. This room is a placeholder — add its devices
            to ROOMS in src/config/home.ts once they exist in Home Assistant.
          </Text>
        </View>
      ) : (
        room.controls.map((control) => (
          <Control key={`${control.kind}-${control.label}`} control={control} />
        ))
      )}
    </ModalSheet>
  );
}

const styles = StyleSheet.create({
  empty: {
    paddingVertical: Spacing.four,
    paddingHorizontal: Spacing.two,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: Palette.border,
  },
});
