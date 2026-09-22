/**
 * A row of chips where exactly one is lit — hourly / daily on the energy charts. Built
 * from the shared chip chrome so it reads like every other toggle on the panel.
 */
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { GlobalStyles, Palette, Spacing, Type } from '@/constants/styles';

export interface Segment<T extends string> {
  value: T;
  label: string;
}

export function SegmentedControl<T extends string>({
  segments,
  value,
  onChange,
}: {
  segments: Segment<T>[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <View style={styles.row} accessibilityRole="tablist">
      {segments.map((segment) => {
        const selected = segment.value === value;
        return (
          <Pressable
            key={segment.value}
            onPress={() => onChange(segment.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={segment.label}
            hitSlop={6}
            style={({ pressed }) => [
              GlobalStyles.chip,
              selected && GlobalStyles.chipActive,
              selected && styles.chipSelected,
              pressed && GlobalStyles.pressed,
            ]}
          >
            <Text style={[Type.label, selected && styles.labelSelected]}>
              {segment.label.toUpperCase()}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: Spacing.one,
  },
  chipSelected: {
    backgroundColor: Palette.panelActive,
  },
  labelSelected: {
    color: Palette.primary,
  },
});
