# quills brand assets

Source: masters/quills-logo-v1.png, approved by the user. SVG files contain traced vector paths, not embedded bitmaps or font dependencies. Light and dark artwork shares the same geometry.

`logo-dark` means dark ink for a light interface; `logo-light` means light ink for a dark interface. Favicons are named by their background. `favicon.svg` follows the browser color scheme. Manifest icons keep the mark inside the central safe circle.

Regenerate from the repository root with `node scripts/branding/generate-assets.mjs` (ImageMagick, librsvg and Potrace required only for regeneration). Normal app builds do not need these export tools. Regeneration verifies the approved master hash before exporting; a new master needs a new approval pin in scripts/branding/approved-master.mjs. Android foreground and monochrome exports are checked pixel by pixel against the 66dp safe circle in a 108dp layer (https://developer.android.com/develop/ui/compose/system/icon_design_adaptive).

The public directory contains SVG and PNG lockups, standalone marks, theme-aware SVG favicons, multi-size ICO, 16/32/48/96/256px PNG favicons, 180px Apple icon, 192/512px install icons, 1024px app icon, email mark, social card, and native icon/splash exports. `branding/config.json` maps approved hashes into each app without editing upstream artwork.
