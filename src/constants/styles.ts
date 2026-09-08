/**
 * The single source of truth for how this app looks.
 *
 * Every screen and component builds on this file: colours, type sizes, radii, spacing and
 * the shared "panel" chrome. Nothing should hardcode a hex value, font size or radius of
 * its own — add it here and reference it, so a palette change stays a one-file change.
 *
 * The look is the synthwave HUD: deep indigo ground, hot-pink primary signal, cyan
 * counter-accent, monospaced micro-labels and thin bracketed panels.
 */
import { StyleSheet } from 'react-native';

import { Fonts, Spacing } from '@/constants/theme';

export { Fonts, Spacing };

export const Palette = {
  /** Page ground. */
  bg: '#150B2E',
  /** Raised surface: cards, panels, rows. */
  panel: '#1F1247',
  /** Recessed surface: tiles and wells inside a panel. */
  panelDeep: '#180D38',
  /** Selected / active surface. */
  panelActive: '#2C1358',
  border: '#3E2578',
  /** Main signal: active state, focus, the number that matters. */
  primary: '#FF3C9E',
  /** Counter-accent: today, links, secondary emphasis. */
  secondary: '#2DE2E6',
  /** Attention, but not an error. */
  warn: '#FFB347',
  /** Failure. */
  danger: '#FF4D6D',
  text: '#F6E9FF',
  textMuted: '#9070D8',
} as const;

export const Radius = {
  sm: 4,
  md: 8,
  lg: 14,
  pill: 999,
} as const;

/** Text presets. Screens use these rather than inventing sizes. */
export const Type = StyleSheet.create({
  /** Page heading. */
  title: { fontSize: 26, lineHeight: 32, fontWeight: '700', color: Palette.text, letterSpacing: 0.5 },
  /** Panel heading. */
  heading: { fontSize: 15, lineHeight: 20, fontWeight: '700', color: Palette.text, letterSpacing: 1.2 },
  body: { fontSize: 14, lineHeight: 20, fontWeight: '500', color: Palette.text },
  bodyMuted: { fontSize: 14, lineHeight: 20, fontWeight: '500', color: Palette.textMuted },
  /** Monospaced uppercase micro-label — the HUD's connective tissue. */
  label: {
    fontFamily: Fonts.mono,
    fontSize: 9,
    lineHeight: 14,
    color: Palette.textMuted,
    letterSpacing: 2,
  },
  /** Monospaced value: times, counts, readouts. */
  mono: { fontFamily: Fonts.mono, fontSize: 11, lineHeight: 16, color: Palette.textMuted, letterSpacing: 1 },
  monoBright: { fontFamily: Fonts.mono, fontSize: 11, lineHeight: 16, color: Palette.text, letterSpacing: 1 },
});

/** Neon comes from a coloured shadow rather than a gradient or a blur. */
export function glow(color: string, radius = 10, opacity = 0.7) {
  return {
    shadowColor: color,
    shadowOpacity: opacity,
    shadowRadius: radius,
    shadowOffset: { width: 0, height: 0 },
  } as const;
}

export const GlobalStyles = StyleSheet.create({
  /** Root of every screen. */
  screen: { flex: 1, backgroundColor: Palette.bg },
  /** Inset content area inside a screen. */
  content: { flex: 1, paddingHorizontal: Spacing.four, paddingBottom: Spacing.three, gap: Spacing.three },

  /** Bracketed instrument panel — the app's standard container. */
  panel: {
    backgroundColor: Palette.panel,
    borderWidth: 1,
    borderColor: Palette.border,
    borderRadius: Radius.sm,
    padding: Spacing.three,
    gap: Spacing.two,
    overflow: 'hidden',
  },
  /** Corner rules, rendered as the panel's first children. */
  bracket: { position: 'absolute', width: 14, height: 14, borderColor: Palette.primary, opacity: 0.5 },
  bracketTopLeft: { top: 5, left: 5, borderTopWidth: 1, borderLeftWidth: 1 },
  bracketBottomRight: { bottom: 5, right: 5, borderBottomWidth: 1, borderRightWidth: 1 },

  /** Recessed row inside a panel: a task, an event, a device. */
  tile: {
    backgroundColor: Palette.panelDeep,
    borderWidth: 1,
    borderColor: Palette.border,
    borderRadius: Radius.sm,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  tileActive: { borderColor: Palette.primary, backgroundColor: Palette.panelActive },

  /** Label + hairline rule, used to break a list into sections. */
  divider: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  dividerRule: { flex: 1, height: 1, backgroundColor: Palette.border },

  chip: {
    borderWidth: 1,
    borderColor: Palette.border,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.two,
    paddingVertical: 3,
  },
  chipActive: { borderColor: Palette.primary },

  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  spread: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  /** Standard scroll body: gap between rows, room to scroll past the last one. */
  listContent: { gap: Spacing.two, paddingBottom: Spacing.four },

  /** Small status dot; tint it with a Palette colour. */
  led: { width: 6, height: 6, borderRadius: 3, backgroundColor: Palette.border },

  pressed: { opacity: 0.6 },
  error: { color: Palette.danger },
});
