/**
 * Whole-house consumption for the last week, in the shared modal shell.
 */
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { BarChart, type Bar } from '@/components/bar-chart';
import { ModalSheet } from '@/components/modal-sheet';
import { ENERGY_HISTORY_DAYS } from '@/config/home';
import { GlobalStyles, Palette, Spacing, Type } from '@/constants/styles';
import { useDailyEnergy } from '@/hooks/use-daily-energy';

export function PowerModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { entries, loading, error } = useDailyEnergy();

  const bars: Bar[] = entries.map((day) => ({
    key: day.start.toISOString(),
    label: day.start.toLocaleDateString([], { weekday: 'short' }).toUpperCase(),
    value: day.kwh,
    // Today is still accumulating, so it is drawn hollow rather than compared as an equal.
    muted: day.partial,
  }));

  const complete = entries.filter((d) => !d.partial);
  const average = complete.length
    ? complete.reduce((total, d) => total + d.kwh, 0) / complete.length
    : null;

  return (
    <ModalSheet
      visible={visible}
      title="Power"
      subtitle={`Last ${ENERGY_HISTORY_DAYS} days`}
      icon={{ ios: 'bolt.fill', android: 'bolt', web: 'bolt' }}
      onClose={onClose}>
      <View style={[GlobalStyles.tile, styles.body]}>
        {loading && <ActivityIndicator size="small" color={Palette.textMuted} />}
        {!!error && <Text style={[Type.mono, GlobalStyles.error]}>{error}</Text>}

        {!loading && !error && (
          <>
            <BarChart bars={bars} unit="kWh" height={170} />
            <View style={GlobalStyles.divider}>
              <Text style={Type.label}>
                DAILY AVERAGE {average === null ? '—' : `${average.toFixed(1)} KWH`}
              </Text>
              <View style={GlobalStyles.dividerRule} />
              <Text style={Type.label}>TODAY STILL COUNTING</Text>
            </View>
          </>
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
