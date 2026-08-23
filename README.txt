FONT PHYSICS LAB

A mobile-web laboratory game for 4-year-olds where letterform parameters
(weight, width, slant) have physical consequences: an O whose counter
gauges balls, a C whose aperture admits them, an I whose lean rolls them.

  npm install
  npm run dev        # local dev server
  npm run build      # typecheck + production build
  npm test           # geometry/collision consistency (vitest)
  npm run e2e        # chromium smoke loop at 4 mobile viewports

Design notes: FONT_LAB_NOTES.md
