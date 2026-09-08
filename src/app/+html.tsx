import { ScrollViewStyleReset } from 'expo-router/html';
import { type PropsWithChildren } from 'react';

/**
 * Root HTML shell for the static web export. Runs only in Node, at build time.
 *
 * Home Assistant serves `config/www` under `/local/` with no directory index — requesting
 * `/local/ha-frontend/` returns 403 — so Fully Kiosk has to load `.../index.html` by name.
 * Expo Router then reads that pathname, strips the `experiments.baseUrl` prefix and is left
 * with `/index.html`, which matches no route and renders the not-found screen.
 *
 * The inline script below rewrites the address to the directory form before the bundle
 * loads, so the router starts at `/`. It runs in `<head>`, ahead of the deferred bundle
 * script, and only fires when the path actually ends in `/index.html`, leaving a normal
 * root-hosted deployment untouched.
 */
const NORMALISE_ENTRY_PATH = `
(function () {
  var suffix = '/index.html';
  var path = window.location.pathname;
  if (path.length >= suffix.length && path.slice(-suffix.length) === suffix) {
    var directory = path.slice(0, path.length - 'index.html'.length);
    window.history.replaceState(null, '', directory + window.location.search + window.location.hash);
  }
})();
`;

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        <script dangerouslySetInnerHTML={{ __html: NORMALISE_ENTRY_PATH }} />
        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  );
}
