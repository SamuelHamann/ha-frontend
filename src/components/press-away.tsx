/**
 * Lets a control notice a press that landed anywhere else — how a pinned chart bubble
 * lets go. Touches are reported from the root of each native view hierarchy (the app,
 * and every modal, which renders in a hierarchy of its own); on the web a document
 * listener covers everything, modals included.
 */
import { Platform, View, type ViewProps } from 'react-native';

type Listener = () => void;
const listeners = new Set<Listener>();

/** Hears every press in the app until unsubscribed. */
export function onPressAnywhere(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Wraps a native view hierarchy's root. `onTouchStart` hears every touch inside without
 * claiming it, so the children behave exactly as before.
 */
export function PressAwayRoot(props: ViewProps) {
  if (Platform.OS === 'web') return <View {...props} />;
  return (
    <View
      {...props}
      onTouchStart={(e) => {
        for (const listener of listeners) listener();
        props.onTouchStart?.(e);
      }}
    />
  );
}
