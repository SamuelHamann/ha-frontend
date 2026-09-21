/**
 * One metered device's consumption, hourly or daily, in the shared modal shell. The live
 * draw sits in the header so the chart and the "now" reading can be compared at a glance.
 */
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { EnergyChart, PERIOD_SEGMENTS, periodSubtitle } from '@/components/energy-chart';
import { ModalSheet } from '@/components/modal-sheet';
import { SegmentedControl } from '@/components/segmented-control';
import { GlobalStyles, Spacing, Type } from '@/constants/styles';
import { useEnergyDays, useEnergySource, type EnergyPeriod } from '@/hooks/use-energy-statistics';
import type { MeteredDeviceState } from '@/hooks/use-metered-devices';

export function formatWatts(watts: number | null, unit: string) {
  return watts === null ? '—' : `${Math.round(watts)} ${unit}`;
}

export function DeviceEnergyModal({
  device,
  onClose,
}: {
  /** Null keeps the modal mounted but hidden, so it fades rather than pops. */
  device: MeteredDeviceState | null;
  onClose: () => void;
}) {
  const [period, setPeriod] = useState<EnergyPeriod>('hour');
  const { buckets, error } = useEnergySource(device?.source ?? null);
  const { days } = useEnergyDays();

  return (
    <ModalSheet
      visible={device !== null}
      size="wide"
      title={device?.name ?? ''}
      subtitle={device ? `${formatWatts(device.watts, device.unit)} NOW · ${periodSubtitle(period)}` : undefined}
      icon={{ ios: 'bolt.fill', android: 'bolt', web: 'bolt' }}
      accessory={<SegmentedControl segments={PERIOD_SEGMENTS} value={period} onChange={setPeriod} />}
      onClose={onClose}
    >
      <View style={[GlobalStyles.tile, styles.body]}>
        {device && !device.source && (
          <Text style={Type.bodyMuted}>No consumption recorded for this device</Text>
        )}
        {device?.source && (
          <EnergyChart
            buckets={buckets?.[period] ?? null}
            days={days}
            error={error}
            period={period}
          />
        )}
      </View>
    </ModalSheet>
  );
}

const styles = StyleSheet.create({
  body: {
    gap: Spacing.three,
    paddingVertical: Spacing.three,
  },
});
