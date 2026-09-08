/**
 * Picks a bulb colour by hue and saturation, in the app's shared modal shell.
 *
 * Hue and saturation get a track painted with the colours they choose between, rather than a
 * colour wheel: a wheel needs a canvas or SVG, and on a wall panel a wide track is a far
 * easier target than a small disc.
 */
import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ModalSheet } from '@/components/modal-sheet';
import { Slider } from '@/components/slider';
import { GlobalStyles, Palette, Radius, Spacing, Type } from '@/constants/styles';

export type Rgb = [number, number, number];

const HUE_STEPS = 60;
const SATURATION_STEPS = 24;

/** HSV with value pinned to 1 — brightness is the bulb's own intensity control. */
export function hsvToRgb(hue: number, saturation: number): Rgb {
  const h = ((hue % 360) + 360) % 360;
  const s = Math.min(Math.max(saturation, 0), 1);
  const c = s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = 1 - c;

  const [r, g, b] =
    h < 60
      ? [c, x, 0]
      : h < 120
        ? [x, c, 0]
        : h < 180
          ? [0, c, x]
          : h < 240
            ? [0, x, c]
            : h < 300
              ? [x, 0, c]
              : [c, 0, x];

  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}

export function rgbToHsv(rgb: Rgb): { hue: number; saturation: number } {
  const [r, g, b] = rgb.map((v) => v / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;

  let hue = 0;
  if (delta !== 0) {
    if (max === r) hue = 60 * (((g - b) / delta) % 6);
    else if (max === g) hue = 60 * ((b - r) / delta + 2);
    else hue = 60 * ((r - g) / delta + 4);
  }

  return { hue: (hue + 360) % 360, saturation: max === 0 ? 0 : delta / max };
}

function css(rgb: Rgb) {
  return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
}

export function ColourPickerModal({
  visible,
  title,
  initial,
  onPick,
  onClose,
}: {
  visible: boolean;
  title: string;
  initial: Rgb | null;
  onPick: (rgb: Rgb) => void;
  onClose: () => void;
}) {
  const start = useMemo(() => rgbToHsv(initial ?? [255, 170, 90]), [initial]);
  const [hue, setHue] = useState(start.hue);
  const [saturation, setSaturation] = useState(Math.round(start.saturation * 100));

  const rgb = hsvToRgb(hue, saturation / 100);

  const hueRamp = useMemo(
    () => Array.from({ length: HUE_STEPS }, (_, i) => css(hsvToRgb((i / HUE_STEPS) * 360, 1))),
    [],
  );
  // The saturation ramp is rebuilt per hue, so the track always shows this colour's range.
  const saturationRamp = useMemo(
    () =>
      Array.from({ length: SATURATION_STEPS }, (_, i) =>
        css(hsvToRgb(hue, i / (SATURATION_STEPS - 1))),
      ),
    [hue],
  );

  /** Applied on release so the bulb follows along, rather than hiding behind a Save button. */
  const apply = (next: Rgb) => onPick(next);

  return (
    <ModalSheet
      visible={visible}
      title={title}
      subtitle="Colour"
      icon={{ ios: 'paintpalette.fill', android: 'palette', web: 'palette' }}
      onClose={onClose}
    >
      <View style={[GlobalStyles.tile, styles.body]}>
        <View style={styles.previewRow}>
          <View style={[styles.preview, { backgroundColor: css(rgb) }]} />
          <View style={styles.previewText}>
            <Text style={Type.body}>{`RGB ${rgb.join(' · ')}`}</Text>
            <Text style={Type.mono}>
              HUE {Math.round(hue)}° · SAT {saturation}%
            </Text>
          </View>
        </View>

        <View style={styles.field}>
          <Text style={Type.label}>HUE</Text>
          <Slider
            value={hue}
            min={0}
            max={359}
            segments={hueRamp}
            onCommit={(next) => {
              setHue(next);
              apply(hsvToRgb(next, saturation / 100));
            }}
          />
        </View>

        <View style={styles.field}>
          <Text style={Type.label}>SATURATION</Text>
          <Slider
            value={saturation}
            min={0}
            max={100}
            segments={saturationRamp}
            onCommit={(next) => {
              setSaturation(next);
              apply(hsvToRgb(hue, next / 100));
            }}
          />
        </View>
      </View>
    </ModalSheet>
  );
}

const styles = StyleSheet.create({
  body: {
    gap: Spacing.three,
    paddingVertical: Spacing.three,
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  preview: {
    width: 64,
    height: 64,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Palette.border,
  },
  previewText: {
    flex: 1,
    gap: 2,
  },
  field: {
    gap: 2,
  },
});
