/**
 * A sensor's recent history as a bar chart — the garden humidity on the outdoor card.
 *
 * Raw history points arrive irregularly (the sensor only reports on change), so they are
 * bucketed into one bar per hour and averaged. An hour with no reading is left out rather
 * than drawn as zero, which would read as "bone dry" instead of "no data".
 */
import { ActivityIndicator, StyleSheet, Text } from 'react-native';

import { BarChart, type Bar } from '@/components/bar-chart';
import { ControlShell } from '@/components/control-shell';
import { GlobalStyles, Palette, Type } from '@/constants/styles';
import { useDeviceEntity } from '@/hooks/use-device-entity';
import { useHistory } from '@/hooks/use-history';

export function ControlHistory({
  label,
  deviceId,
  deviceClass,
  hours,
}: {
  label: string;
  deviceId: string;
  deviceClass: string;
  hours: number;
}) {
  const entity = useDeviceEntity(deviceId, 'sensor', 0, deviceClass);
  const { points, loading, error } = useHistory(entity?.entityId ?? null, hours);

  const unit = entity?.attributes?.unit_of_measurement ?? '%';
  const now = new Date();

  const bars: Bar[] = [];
  for (let i = hours - 1; i >= 0; i--) {
    const slot = new Date(now.getTime() - i * 3600 * 1000);
    const from = new Date(slot.getFullYear(), slot.getMonth(), slot.getDate(), slot.getHours());
    const to = new Date(from.getTime() + 3600 * 1000);
    const inSlot = points.filter((p) => p.at >= from.getTime() && p.at < to.getTime());
    if (inSlot.length === 0) continue;
    bars.push({
      key: from.toISOString(),
      label: String(from.getHours()).padStart(2, '0'),
      value: inSlot.reduce((total, p) => total + p.value, 0) / inSlot.length,
    });
  }

  return (
    <ControlShell
      label={label}
      status={entity ? `${Number(entity.state).toFixed(1)}${unit} NOW` : 'UNAVAILABLE'}
      statusTone={entity ? 'muted' : 'warn'}>
      {loading && <ActivityIndicator size="small" color={Palette.textMuted} />}
      {!!error && <Text style={[Type.mono, GlobalStyles.error]}>{error}</Text>}
      {/* Humidity drifts within a percent or so; a zero axis would flatten it. */}
      {!loading && !error && <BarChart bars={bars} unit={unit} height={120} baseline="auto" />}
      {!loading && !error && bars.length > 0 && (
        <Text style={[Type.label, styles.axis]}>HOUR OF DAY</Text>
      )}
    </ControlShell>
  );
}

const styles = StyleSheet.create({
  axis: {
    textAlign: 'center',
  },
});
