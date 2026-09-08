# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

# Global styles

`src/constants/styles.ts` is the single source of truth for how this app looks — the
synthwave palette, type presets, radii, spacing and the shared panel/tile/divider chrome.

Read it before writing or changing any UI, and build every screen and component from it.
Never hardcode a colour, font size or radius in a screen: if something is missing, add it to
`src/constants/styles.ts` and reference it from there, so a look change stays a one-file change.
