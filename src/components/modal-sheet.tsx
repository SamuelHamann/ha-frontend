/**
 * The one modal shell in the app: a bracketed panel over a dimmed page, with a title, a
 * close button and a scrolling body. Every modal — rooms, power — is this frame with
 * different content inside, so they open, close and read identically.
 */
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import type { ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { GestureHandlerRootView, ScrollView } from 'react-native-gesture-handler';

import { Panel } from '@/components/panel';
import { GlobalStyles, Palette, Radius, Spacing, Type } from '@/constants/styles';

export interface AnchorRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Room to leave around a popover, and the narrowest it may be. */
const ANCHOR_GAP = 8;
const ANCHOR_MARGIN = 16;
const ANCHOR_MIN_WIDTH = 288;
/** Rough popover height, used only to decide whether it fits below its anchor. */
const ANCHOR_ESTIMATED_HEIGHT = 240;

export function ModalSheet({
  visible,
  title,
  subtitle,
  icon,
  accessory,
  anchor,
  onClose,
  children,
}: {
  visible: boolean;
  title: string;
  subtitle?: string;
  icon?: SymbolViewProps['name'];
  /** Rendered in the header, before the close button — a room's presence marker, say. */
  accessory?: ReactNode;
  /**
   * Screen rect of the control that opened this. When given, the sheet is pinned just below
   * that rect instead of centred — a popover hanging off the card you tapped.
   */
  anchor?: AnchorRect;
  onClose: () => void;
  children: ReactNode;
}) {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();

  // Hangs below the anchor, flipping above it when there isn't room, and never runs off
  // either edge of the screen.
  const anchored = anchor
    ? (() => {
        const width = Math.min(
          Math.max(anchor.width, ANCHOR_MIN_WIDTH),
          screenWidth - ANCHOR_MARGIN * 2,
        );
        const left = Math.min(
          Math.max(anchor.x, ANCHOR_MARGIN),
          screenWidth - width - ANCHOR_MARGIN,
        );
        const below = anchor.y + anchor.height + ANCHOR_GAP;
        const fitsBelow = below + ANCHOR_ESTIMATED_HEIGHT <= screenHeight - ANCHOR_MARGIN;

        return fitsBelow
          ? { position: 'absolute' as const, left, width, top: below }
          : {
              position: 'absolute' as const,
              left,
              width,
              bottom: screenHeight - anchor.y + ANCHOR_GAP,
            };
      })()
    : null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      {/*
        A React Native Modal renders into its own native hierarchy — a Dialog on Android —
        so its contents are not descendants of the app's root gesture view. Without a root
        view of its own, no gesture inside here fires, which would leave the bulb sliders
        dead to touch. The ScrollView is gesture-handler's too, so it coordinates with the
        sliders rather than swallowing their drags.
      */}
      <GestureHandlerRootView style={styles.root}>
        {/* Tapping the dimmed page closes, as a modal on a wall panel should. */}
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close" />

        <View style={[styles.centre, !!anchored && styles.anchoredLayer]} pointerEvents="box-none">
          <Panel style={[styles.sheet, anchored ?? undefined]}>
            <View style={styles.header}>
              {!!icon && (
                <View style={styles.iconChip}>
                  <SymbolView name={icon} tintColor={Palette.primary} size={20} />
                </View>
              )}
              <View style={styles.titles}>
                <Text style={Type.heading}>{title.toUpperCase()}</Text>
                {!!subtitle && <Text style={Type.label}>{subtitle.toUpperCase()}</Text>}
              </View>
              {accessory}
              <Pressable
                onPress={onClose}
                accessibilityRole="button"
                accessibilityLabel="Close"
                hitSlop={10}
                style={({ pressed }) => [styles.close, pressed && GlobalStyles.pressed]}
              >
                <SymbolView
                  name={{ ios: 'xmark', android: 'close', web: 'close' }}
                  tintColor={Palette.text}
                  size={18}
                />
              </Pressable>
            </View>

            <View style={GlobalStyles.dividerRule} />

            <ScrollView
              contentContainerStyle={styles.body}
              showsVerticalScrollIndicator={false}
              // The sheet is capped in height, so long device lists scroll rather than clip.
              style={styles.scroll}
            >
              {children}
            </ScrollView>
          </Panel>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  // RN 0.86 dropped StyleSheet.absoluteFillObject.
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(8, 4, 20, 0.72)',
  },
  centre: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
  },
  /** An anchored sheet positions itself, so the centring padding must not shift it. */
  anchoredLayer: {
    padding: 0,
  },
  sheet: {
    width: '100%',
    maxWidth: 640,
    maxHeight: '88%',
    gap: Spacing.three,
    shadowColor: '#000000',
    shadowOpacity: 0.5,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  iconChip: {
    width: 38,
    height: 38,
    borderRadius: Radius.sm,
    backgroundColor: Palette.panelDeep,
    borderWidth: 1,
    borderColor: Palette.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titles: {
    flex: 1,
    gap: 2,
  },
  close: {
    width: 38,
    height: 38,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Palette.border,
    backgroundColor: Palette.panelDeep,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    flexGrow: 0,
  },
  body: {
    gap: Spacing.two,
    paddingBottom: Spacing.one,
  },
});
