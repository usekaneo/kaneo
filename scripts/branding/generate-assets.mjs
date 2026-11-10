import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile, rm, cp } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { root, digest, safeCacheOutput } from "./assets.mjs";
import { assertApprovedMaster } from "./approved-master.mjs";
import { assertAndroidSafeArea } from "./native-safe-area.mjs";

const directory = path.join(root, "branding/assets/quills");
const output = path.join(directory, "public");
const temporary = path.join(root, ".cache/quills-asset-export");
const ink = "#171717";
const paper = "#f5f5f5";
const run = (command, args) =>
  execFileSync(command, args, { encoding: "utf8" });

// Only export tooling needs ImageMagick, librsvg and Potrace. Builds use the committed assets.
async function trace(name, crop = []) {
  const bitmap = path.join(temporary, `${name}.pbm`);
  const traced = path.join(temporary, `${name}.svg`);
  run("magick", [
    path.join(root, "branding/assets/quills-logo-v1.png"),
    ...crop,
    "-trim",
    "+repage",
    "-alpha",
    "extract",
    "-threshold",
    "50%",
    "-negate",
    bitmap,
  ]);
  run("potrace", [
    "--svg",
    "--turdsize",
    "8",
    "--opttolerance",
    "0.2",
    "--output",
    traced,
    bitmap,
  ]);
  const svg = await readFile(traced, "utf8");
  const [, width, height] = svg.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/) ?? [];
  const body = svg
    .match(/<g\b[\s\S]*<\/g>/)?.[0]
    .replace('fill="#000000"', 'fill="currentColor"');
  if (!width || !height || !body)
    throw new Error(`Invalid traced artwork: ${name}`);
  return { width: Number(width), height: Number(height), body };
}

function svg(width, height, body, color = ink, style = "") {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" style="color:${color}" role="img" aria-label="quills"><title>quills</title>${style}${body}</svg>\n`;
}

function markBody(mark, size, fraction) {
  const scale = (size * fraction) / Math.max(mark.width, mark.height);
  return `<g transform="translate(${(size - mark.width * scale) / 2} ${(size - mark.height * scale) / 2}) scale(${scale})">${mark.body}</g>`;
}

function icon(mark, size, fraction, background, color, adaptive = false) {
  const style = adaptive
    ? `<style>:root{--paper:${paper};--ink:${ink};color:var(--ink)!important}@media(prefers-color-scheme:dark){:root{--paper:${ink};--ink:${paper}}}</style>`
    : "";
  const backdrop = background
    ? `<rect width="${size}" height="${size}" fill="${adaptive ? "var(--paper)" : background}"/>`
    : "";
  return svg(
    size,
    size,
    backdrop + markBody(mark, size, fraction),
    color,
    style,
  );
}

async function save(name, source) {
  const target = path.join(output, name);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, source);
  return target;
}

async function png(name, source, size) {
  const input = path.join(temporary, "render.svg");
  await writeFile(input, source);
  const target = path.join(output, name);
  await mkdir(path.dirname(target), { recursive: true });
  run("rsvg-convert", ["--width", String(size), "--output", target, input]);
  run("magick", [target, "-strip", `PNG32:${target}`]);
  if (/android-icon-(foreground|monochrome)\.png$/.test(name))
    assertAndroidSafeArea(await readFile(target));
  if (
    !name.endsWith("android-icon-background.png") &&
    Number(run("magick", [target, "-format", "%k", "info:"])) <= 2
  )
    throw new Error(`Artwork rendered blank: ${name}`);
}

async function generate() {
  await safeCacheOutput(temporary);
  await mkdir(output, { recursive: true });
  await mkdir(temporary, { recursive: true });
  const source = await readFile(
    path.join(root, "branding/assets/quills-logo-v1.png"),
  );
  assertApprovedMaster(source);
  const width = source.readUInt32BE(16);
  const height = source.readUInt32BE(20);
  if (width !== height * 3)
    throw new Error(
      "Expected the approved 3:1 logo master; review the symbol crop before exporting a new design",
    );
  const logo = await trace("logo");
  // Leave the first pixels of the source wordmark outside the symbol crop.
  const mark = await trace("mark", [
    "-crop",
    `${Math.floor(height * 0.95)}x${height}+0+0`,
    "+repage",
  ]);
  for (const [tone, color] of [
    ["dark", ink],
    ["light", paper],
  ]) {
    const lockup = svg(logo.width, logo.height, logo.body, color);
    await save(`logo-${tone}.svg`, lockup);
    await png(`logo-${tone}.png`, lockup, 1800);
    const standalone = icon(mark, 512, 0.8, null, color);
    await save(`mark-${tone}.svg`, standalone);
    await png(`mark-${tone}.png`, standalone, 512);
    const tile = icon(
      mark,
      512,
      0.8,
      tone === "dark" ? ink : paper,
      tone === "dark" ? paper : ink,
    );
    await save(`favicon-${tone}.svg`, tile);
    for (const size of [16, 32, 48, 96])
      await png(`favicon-${tone}-${size}x${size}.png`, tile, size);
  }
  await save("favicon.svg", icon(mark, 512, 0.8, paper, ink, true));
  for (const size of [16, 32, 48, 96])
    await cp(
      path.join(output, `favicon-dark-${size}x${size}.png`),
      path.join(output, `favicon-${size}x${size}.png`),
    );
  await png("favicon-256x256.png", icon(mark, 512, 0.8, ink, paper), 256);
  run("magick", [
    path.join(output, "favicon-256x256.png"),
    "-define",
    "icon:auto-resize=256,128,64,48,32,16",
    "-strip",
    path.join(output, "favicon.ico"),
  ]);
  await png("apple-touch-icon.png", icon(mark, 1024, 0.72, ink, paper), 180);
  for (const size of [192, 512])
    await png(
      `web-app-manifest-${size}x${size}.png`,
      icon(mark, 1024, 0.56, ink, paper),
      size,
    );
  await png("icon-1024.png", icon(mark, 1024, 0.72, ink, paper), 1024);
  await png("email/mark.png", icon(mark, 512, 0.72, ink, paper), 256);
  await png(
    "native/android-icon-foreground.png",
    icon(mark, 1024, 0.45, null, paper),
    1024,
  );
  await png(
    "native/android-icon-monochrome.png",
    icon(mark, 1024, 0.45, null, "#ffffff"),
    1024,
  );
  await png(
    "native/notification-icon.png",
    icon(mark, 96, 0.8, null, "#ffffff"),
    96,
  );
  await png("native/splash-icon.png", icon(mark, 512, 0.72, null, ink), 512);
  await png(
    "native/splash-icon-dark.png",
    icon(mark, 512, 0.72, null, paper),
    512,
  );
  await png(
    "native/android-icon-background.png",
    svg(1024, 1024, '<rect width="1024" height="1024" fill="#171717"/>'),
    1024,
  );
  const scale = 900 / logo.width;
  const social = svg(
    1200,
    630,
    `<rect width="1200" height="630" fill="${paper}"/><g transform="translate(150 ${(630 - logo.height * scale) / 2}) scale(${scale})">${logo.body}</g>`,
  );
  await png("readme.png", social, 1200);
  await save(
    "site.webmanifest",
    JSON.stringify(
      {
        name: "quills",
        short_name: "quills",
        start_url: "/",
        display: "standalone",
        theme_color: ink,
        background_color: ink,
        icons: await Promise.all(
          [192, 512].map(async (size) => ({
            src: `/web-app-manifest-${size}x${size}.png?brand=${digest(await readFile(path.join(output, `web-app-manifest-${size}x${size}.png`)))}`,
            sizes: `${size}x${size}`,
            type: "image/png",
            purpose: "maskable",
          })),
        ),
      },
      null,
      2,
    ) + "\n",
  );
  await save(
    "quills-brand-kit.html",
    `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>quills brand assets</title><style>
  *{box-sizing:border-box}body{margin:0;background:#e8e8e8;color:#171717;font:16px/1.5 system-ui,sans-serif}main{max-width:1100px;margin:auto;padding:40px 24px}h1{margin:0 0 8px;font-size:32px}p{margin:0 0 24px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:20px}.panel{padding:28px;border-radius:16px;background:#f5f5f5}.dark{background:#171717;color:#f5f5f5}h2{font-size:14px;font-weight:500;margin:0 0 24px;opacity:.7}.logo{width:100%;height:120px;object-fit:contain}.marks{display:flex;align-items:center;gap:24px;margin-top:24px}.mark{width:100px;height:100px}.icons{display:flex;align-items:center;flex-wrap:wrap;gap:24px}figure{margin:0;text-align:center}figcaption{font-size:12px;margin-top:8px;opacity:.65}.install{width:96px;height:96px;border-radius:20px}.mask{clip-path:circle(40%);width:96px;height:96px}.wide{grid-column:1/-1}.social{display:block;width:100%;height:auto}@media(max-width:650px){.grid{grid-template-columns:1fr}.wide{grid-column:auto}.logo{height:80px}}
  </style><main><h1>quills</h1><p>Logo, favicon, app and email assets</p><div class="grid">
  <section class="panel"><h2>Light interface</h2><img class="logo" src="logo-dark.svg" alt="quills dark logo"><div class="marks"><img class="mark" src="mark-dark.svg" alt="quills dark mark"><img width="48" height="48" src="favicon-light.svg" alt="Light favicon"></div></section>
  <section class="panel dark"><h2>Dark interface</h2><img class="logo" src="logo-light.svg" alt="quills light logo"><div class="marks"><img class="mark" src="mark-light.svg" alt="quills light mark"><img width="48" height="48" src="favicon-dark.svg" alt="Dark favicon"></div></section>
  <section class="panel wide"><h2>Favicons at actual size</h2><div class="icons">${[16, 32, 48, 96].map((size) => `<figure><img width="${size}" height="${size}" src="favicon-${size}x${size}.png" alt="${size} pixel favicon"><figcaption>${size} px</figcaption></figure>`).join("")}</div></section>
  <section class="panel wide"><h2>Install, email and masked app icons</h2><div class="icons"><figure><img class="install" src="apple-touch-icon.png" alt="Apple touch icon"><figcaption>Apple touch</figcaption></figure><figure><img class="install" src="web-app-manifest-192x192.png" alt="Install icon"><figcaption>Web app</figcaption></figure><figure><img class="install" src="email/mark.png" alt="Email mark"><figcaption>Email</figcaption></figure><figure><img class="mask" src="web-app-manifest-512x512.png" alt="Icon inside mask safe area"><figcaption>Safe circle</figcaption></figure></div></section>
  <section class="panel wide"><h2>Social preview · 1200 × 630</h2><img class="social" src="readme.png" alt="quills social preview"></section>
  </div></main></html>\n`,
  );

  const mappings = [];
  const add = (source, target) =>
    mappings.push({ source: `assets/quills/public/${source}`, target });
  const web = [
    "logo-dark.svg",
    "logo-light.svg",
    "logo-dark.png",
    "logo-light.png",
    "mark-dark.svg",
    "mark-light.svg",
    "mark-dark.png",
    "mark-light.png",
    "favicon.svg",
    "favicon-dark.svg",
    "favicon-light.svg",
    "favicon.ico",
    "favicon-16x16.png",
    "favicon-32x32.png",
    "favicon-48x48.png",
    "favicon-96x96.png",
    "favicon-256x256.png",
    "apple-touch-icon.png",
    "web-app-manifest-192x192.png",
    "web-app-manifest-512x512.png",
    "icon-1024.png",
    "email/mark.png",
    "readme.png",
    "site.webmanifest",
    "quills-brand-kit.html",
  ];
  for (const tone of ["dark", "light"])
    for (const size of [16, 32, 48, 96])
      web.push(`favicon-${tone}-${size}x${size}.png`);
  for (const name of web) add(name, `apps/web/public/${name}`);
  for (const name of [
    "logo-dark.svg",
    "logo-light.svg",
    "favicon.svg",
    "favicon.ico",
    "apple-touch-icon.png",
  ])
    add(name, `apps/site/public/${name}`);
  add("web-app-manifest-512x512.png", "apps/site/public/logo-512.png");
  for (const tone of ["dark", "light"]) {
    add(`logo-${tone}.svg`, `apps/docs/logo/${tone}.svg`);
    add(`logo-${tone}.svg`, `apps/mobile/assets/brand/logo-${tone}.svg`);
  }
  add("favicon.svg", "apps/docs/favicon.svg");
  add("icon-1024.png", "apps/mobile/assets/images/icon.png");
  for (const name of [
    "android-icon-background",
    "android-icon-foreground",
    "android-icon-monochrome",
    "notification-icon",
    "splash-icon",
    "splash-icon-dark",
  ]) {
    add(`native/${name}.png`, `apps/mobile/assets/images/${name}.png`);
    web.push(`native/${name}.png`);
    add(`native/${name}.png`, `apps/web/public/native/${name}.png`);
  }
  const configFile = path.join(root, "branding/config.json");
  const config = JSON.parse(await readFile(configFile, "utf8"));
  const targets = new Set([
    ...mappings.map((item) => item.target),
    "apps/web/public/quills-brand-kit.zip",
  ]);
  config.assets = [
    ...config.assets.filter((item) => !targets.has(item.target)),
    ...(await Promise.all(
      mappings.map(async (item) => ({
        ...item,
        sha256: digest(
          await readFile(path.join(root, "branding", item.source)),
        ),
        approved: true,
      })),
    )),
  ];
  await writeFile(
    path.join(directory, "README.md"),
    "# quills brand assets\n\nSource: masters/quills-logo-v1.png, approved by the user. SVG files contain traced vector paths, not embedded bitmaps or font dependencies. Light and dark artwork shares the same geometry.\n\n`logo-dark` means dark ink for a light interface; `logo-light` means light ink for a dark interface. Favicons are named by their background. `favicon.svg` follows the browser color scheme. Manifest icons keep the mark inside the central safe circle.\n\nRegenerate from the repository root with `node scripts/branding/generate-assets.mjs` (ImageMagick, librsvg and Potrace required only for regeneration). Normal app builds do not need these export tools. Regeneration verifies the approved master hash before exporting; a new master needs a new approval pin in scripts/branding/approved-master.mjs. Android foreground and monochrome exports are checked pixel by pixel against the 66dp safe circle in a 108dp layer (https://developer.android.com/develop/ui/compose/system/icon_design_adaptive).\n\nThe public directory contains SVG and PNG lockups, standalone marks, theme-aware SVG favicons, multi-size ICO, 16/32/48/96/256px PNG favicons, 180px Apple icon, 192/512px install icons, 1024px app icon, email mark, social card, and native icon/splash exports. `branding/config.json` maps approved hashes into each app without editing upstream artwork.\n",
  );
  await mkdir(path.join(directory, "masters"), { recursive: true });
  await cp(
    path.join(root, "branding/assets/quills-logo-v1.png"),
    path.join(directory, "masters/quills-logo-v1.png"),
  );
  await cp(
    path.join(root, "branding/assets/quills-logo-v1.prompt.md"),
    path.join(directory, "masters/generation-prompt.md"),
  );
  const archive = path.join(directory, "quills-brand-kit.zip");
  await rm(archive, { force: true });
  execFileSync(
    "zip",
    [
      "-X",
      "-q",
      archive,
      "README.md",
      "masters/quills-logo-v1.png",
      "masters/generation-prompt.md",
      ...web.map((name) => `public/${name}`),
    ],
    { cwd: directory },
  );
  config.assets.push({
    source: "assets/quills/quills-brand-kit.zip",
    target: "apps/web/public/quills-brand-kit.zip",
    sha256: digest(await readFile(archive)),
    approved: true,
  });
  await writeFile(configFile, JSON.stringify(config, null, "\t") + "\n");
  await rm(temporary, { recursive: true, force: true });
  console.log(
    `Exported ${web.length} public assets and ${config.assets.length} approved mappings to ${path.relative(root, output)}`,
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await generate();
