/**
 * The frame every device control in a room modal shares: a label, an optional status on the
 * right, and the control's own body beneath.
 */
import { StyleSheet, Text, View, type ViewProps } from 'react-native';

import { GlobalStyles, Palette, Spacing, Type } from '@/constants/styles';

export function ControlShell({
  label,
  status,
  statusTone = 'muted',
  children,
  ...rest
}: ViewProps & {
  label: string;
  status?: string;
  statusTone?: 'muted' | 'on' | 'warn';
}) {
  const statusStyle =
    statusTone === 'on' ? styles.statusOn : statusTone === 'warn' ? styles.statusWarn : undefined;

  return (
    <View {...rest} style={[GlobalStyles.tile, styles.shell]}>
      <View style={GlobalStyles.spread}>
        <Text style={Type.label}>{label.toUpperCase()}</Text>
        {!!status && <Text style={[Type.label, statusStyle]}>{status}</Text>}
      </View>
      {children}
    </View>
  );
}

/** A labelled row inside a control: name on the left, value on the right. */
export function ControlRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={GlobalStyles.spread}>
      <Text style={Type.mono}>{label}</Text>
      <Text style={Type.monoBright}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    gap: Spacing.two,
    paddingVertical: Spacing.three,
  },
  statusOn: {
    color: Palette.warn,
  },
  statusWarn: {
    color: Palette.danger,
  },
});
