import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ConnectionNotice } from '@/components/connection-notice';
import { DeviceEnergyModal, formatWatts } from '@/components/device-energy-modal';
import { EnergyChart, PERIOD_SEGMENTS, periodSubtitle } from '@/components/energy-chart';
import { Panel } from '@/components/panel';
import { SegmentedControl } from '@/components/segmented-control';
import { METERED_DEVICES, METERED_THERMOSTATS } from '@/config/energy';
import { GlobalStyles, Palette, Spacing, Type } from '@/constants/styles';
import { useEnergyBreakdown } from '@/hooks/use-energy-breakdown';
import { useEnergyRange, useEnergyView } from '@/hooks/use-energy-range';
import { useEnergyDays } from '@/hooks/use-energy-statistics';
import { useMeteredDevices, type MeteredDeviceState } from '@/hooks/use-metered-devices';
import { usePower } from '@/hooks/use-power';
import { useHomeAssistantContext } from '@/providers/home-assistant-provider';

/** Below this a device is idle: the LED stays dark and the reading is dimmed. */
const IDLE_WATTS = 1;

function DeviceRow({
  device,
  onOpen,
}: {
  device: MeteredDeviceState;
  onOpen: (device: MeteredDeviceState) => void;
}) {
  const active = device.watts !== null && device.watts >= IDLE_WATTS;

  return (
    <Pressable
      onPress={() => onOpen(device)}
      accessibilityRole="button"
      accessibilityLabel={`${device.name} consumption`}
      style={({ pressed }) => [
        GlobalStyles.tile,
        styles.row,
        active && styles.rowActive,
        pressed && GlobalStyles.pressed,
      ]}
    >
      <View style={[GlobalStyles.led, active && styles.ledActive]} />
      <Text style={[styles.name, !active && styles.nameIdle]} numberOfLines={1}>
        {device.name.toUpperCase()}
      </Text>
      <Text style={[styles.watts, active && styles.wattsActive]}>
        {formatWatts(device.watts, device.unit)}
      </Text>
    </Pressable>
  );
}

function DeviceGroup({
  title,
  devices,
  onOpen,
}: {
  title: string;
  devices: MeteredDeviceState[];
  onOpen: (device: MeteredDeviceState) => void;
}) {
  const reported = devices.filter((d) => d.watts !== null);
  const total = reported.length ? reported.reduce((sum, d) => sum + (d.watts ?? 0), 0) : null;
  const unit = devices[0]?.unit ?? 'W';

  return (
    <Panel>
      <View style={GlobalStyles.spread}>
        <Text style={Type.label}>{title.toUpperCase()}</Text>
        <Text style={Type.label}>{formatWatts(total, unit)}</Text>
      </View>
      <View style={styles.rows}>
        {devices.map((device) => (
          <DeviceRow key={device.deviceId} device={device} onOpen={onOpen} />
        ))}
      </View>
    </Panel>
  );
}

function HousePanel() {
  const { watts, unit, kwhToday } = usePower();
  const { view, setPeriod, back, forward, home } = useEnergyView('hour');
  const range = useEnergyRange(view);
  const { buckets, slices, error, loading } = useEnergyBreakdown(range);
  const { days, loading: loadingDays } = useEnergyDays(range);

  return (
    <Panel style={styles.housePanel}>
      <View style={GlobalStyles.spread}>
        <Text style={Type.label}>HOUSE · {periodSubtitle(view.period).toUpperCase()}</Text>
        <SegmentedControl segments={PERIOD_SEGMENTS} value={view.period} onChange={setPeriod} />
      </View>

      <View style={styles.readouts}>
        <View style={styles.readout}>
          <SymbolView
            name={{ ios: 'bolt.fill', android: 'bolt', web: 'bolt' }}
            tintColor={Palette.warn}
            size={26}
          />
          <Text style={Type.readout}>
            {watts === null ? '—' : Math.round(watts)}
            <Text style={Type.mono}> {unit}</Text>
          </Text>
          <Text style={Type.label}>NOW</Text>
        </View>
        <View style={styles.readoutRule} />
        <View style={styles.readout}>
          <Text style={[Type.readout, styles.readoutSecondary]}>
            {kwhToday === null ? '—' : kwhToday.toFixed(1)}
            <Text style={Type.mono}> kWh</Text>
          </Text>
          <Text style={Type.label}>TODAY</Text>
        </View>
      </View>

      <View style={[GlobalStyles.tile, styles.chartTile]}>
        <EnergyChart
          view={view}
          range={range}
          buckets={buckets}
          days={days}
          loading={loading || loadingDays}
          error={error}
          slices={slices}
          height={200}
          onBack={back}
          onForward={forward}
          onHome={home}
        />
      </View>
    </Panel>
  );
}

function EnergyBody() {
  const thermostats = useMeteredDevices(METERED_THERMOSTATS);
  const others = useMeteredDevices(METERED_DEVICES);
  const [open, setOpen] = useState<MeteredDeviceState | null>(null);

  // The open device is looked up by id each render so its header reading stays live.
  const current = open
    ? ([...thermostats, ...others].find((d) => d.deviceId === open.deviceId) ?? open)
    : null;

  return (
    <View style={styles.columns}>
      <DeviceEnergyModal device={current} onClose={() => setOpen(null)} />

      <View style={styles.chartColumn}>
        <HousePanel />
      </View>

      {/* The flex lives on a View: on web, ScrollView's own base style overrides it. */}
      <View style={styles.listColumn}>
        <ScrollView contentContainerStyle={GlobalStyles.listContent} showsVerticalScrollIndicator={false}>
          <DeviceGroup title="Thermostats" devices={thermostats} onOpen={setOpen} />
          <DeviceGroup title="Devices" devices={others} onOpen={setOpen} />
        </ScrollView>
      </View>
    </View>
  );
}

export default function EnergyScreen() {
  const { status, error } = useHomeAssistantContext();
  const connected = status === 'connected';

  return (
    <View style={GlobalStyles.screen}>
      <SafeAreaView style={GlobalStyles.content} edges={['bottom', 'left', 'right']}>
        {connected ? (
          <EnergyBody />
        ) : (
          <Panel>
            <Text style={Type.label}>ENERGY</Text>
            <ConnectionNotice status={status} error={error} />
          </Panel>
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  columns: {
    flex: 1,
    flexDirection: 'row',
    gap: Spacing.three,
  },
  chartColumn: {
    flex: 5,
  },
  listColumn: {
    flex: 4,
  },
  housePanel: {
    gap: Spacing.three,
  },
  readouts: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.four,
  },
  readout: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.two,
  },
  readoutSecondary: {
    color: Palette.secondary,
  },
  readoutRule: {
    width: 1,
    height: 36,
    backgroundColor: Palette.border,
  },
  chartTile: {
    gap: Spacing.three,
    paddingVertical: Spacing.three,
  },
  rows: {
    gap: Spacing.two,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    height: 42,
  },
  rowActive: {
    borderColor: Palette.warn,
  },
  ledActive: {
    backgroundColor: Palette.warn,
  },
  name: {
    ...Type.body,
    flex: 1,
    letterSpacing: 0.8,
  },
  nameIdle: {
    color: Palette.textMuted,
  },
  watts: {
    ...Type.mono,
    fontSize: 18,
    lineHeight: 22,
    // Fixed width so every reading lines up down the column.
    width: 96,
    textAlign: 'right',
  },
  wattsActive: {
    color: Palette.warn,
  },
});
