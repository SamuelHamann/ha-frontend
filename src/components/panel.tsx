/**
 * The app's standard container: a thin bordered surface with corner brackets.
 * All of its styling comes from `@/constants/styles`.
 */
import { View, type StyleProp, type ViewProps, type ViewStyle } from 'react-native';

import { GlobalStyles } from '@/constants/styles';

export function Panel({
  children,
  style,
  ...rest
}: ViewProps & { style?: StyleProp<ViewStyle> }) {
  return (
    <View {...rest} style={[GlobalStyles.panel, style]}>
      <View style={[GlobalStyles.bracket, GlobalStyles.bracketTopLeft]} pointerEvents="none" />
      <View style={[GlobalStyles.bracket, GlobalStyles.bracketBottomRight]} pointerEvents="none" />
      {children}
    </View>
  );
}
