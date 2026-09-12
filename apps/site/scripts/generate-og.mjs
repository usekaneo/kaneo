#!/usr/bin/env node
/**
 * Generates the Open Graph image for every blog post.
 *
 * SVG generation has no dependencies. Rasterising to PNG uses whichever of
 * rsvg-convert or ImageMagick is on the PATH, because `output: "export"` rules
 * out generating these at request time and the PNGs are committed instead.
 *
 *   node scripts/generate-og.mjs            # all posts
 *   node scripts/generate-og.mjs <slug>...  # only these posts
 */

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CONTENT_DIR = path.join(ROOT, "content", "blog");
const SVG_DIR = path.join(ROOT, "scripts", "og");
const PNG_DIR = path.join(ROOT, "public", "images", "blog");

const WIDTH = 1200;
const HEIGHT = 630;
const PADDING = 80;
const TITLE_MAX_SIZE = 60;
const TITLE_MIN_SIZE = 42;
const TITLE_LEADING_RATIO = 1.32;
const MAX_TITLE_LINES = 3;
const FONT = "Geist, Inter, 'Helvetica Neue', Helvetica, Arial, sans-serif";

/**
 * Inlines the shipped logo lockup so the OG image never drifts from the brand
 * mark. logo-dark.svg is the dark-ink version, which is the one for a light card.
 */
function logoMarkup(x, y, height) {
  const source = fs.readFileSync(
    path.join(ROOT, "public", "logo-dark.svg"),
    "utf8",
  );
  const viewBox = source.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/);
  const inner = source
    .replace(/^[\s\S]*?<svg[^>]*>/, "")
    .replace(/<\/svg>\s*$/, "")
    .replace(/<defs>[\s\S]*?<\/defs>/g, "")
    .replace(/\s*clip-path="url\(#[^"]*\)"/g, "")
    .trim();

  if (!viewBox) throw new Error("Could not read the logo viewBox.");
  const scale = height / Number(viewBox[2]);

  return `  <g transform="translate(${x} ${y}) scale(${scale.toFixed(5)})">\n${inner}\n  </g>`;
}

const NARROW = new Set([..."ijltfrI.,:;'`|!()[]{}-"]);
const WIDE = new Set([..."mwMW@%"]);
const UPPER = /[A-Z0-9]/;

/** Approximate advance width, good enough for greedy line breaking. */
function textWidth(text, size) {
  let units = 0;
  for (const char of text) {
    if (char === " ") units += 0.27;
    else if (NARROW.has(char)) units += 0.31;
    else if (WIDE.has(char)) units += 0.88;
    else if (UPPER.test(char)) units += 0.62;
    else units += 0.53;
  }
  return units * size;
}

function wrap(text, size, maxWidth, maxLines) {
  const lines = [];
  let line = "";

  for (const word of text.split(/\s+/)) {
    const candidate = line ? `${line} ${word}` : word;
    if (textWidth(candidate, size) <= maxWidth || line === "") {
      line = candidate;
      continue;
    }
    lines.push(line);
    line = word;
    if (lines.length === maxLines) break;
  }

  if (line && lines.length < maxLines) lines.push(line);

  if (lines.length === maxLines) {
    const last = lines[maxLines - 1];
    const remaining = text.split(/\s+/).join(" ");
    if (lines.join(" ").length < remaining.length) {
      lines[maxLines - 1] = `${last.replace(/[.,;:]$/, "")}…`;
    }
  }

  return lines;
}

function escapeXml(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function readFrontmatter(file) {
  const source = fs.readFileSync(file, "utf8");
  const end = source.indexOf("\n---", 3);
  const data = {};

  for (const line of source.slice(4, end).split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const at = trimmed.indexOf(":");
    if (at === -1) continue;
    let value = trimmed.slice(at + 1).trim();
    const quote = value[0];
    if ((quote === '"' || quote === "'") && value.endsWith(quote)) {
      value = value
        .slice(1, -1)
        .replace(new RegExp(`\\\\${quote}`, "g"), quote);
    }
    data[trimmed.slice(0, at).trim()] = value;
  }

  return data;
}

const AUTHORS = {
  andrej: { name: "Andrej Acevski", role: "Founder, Kaneo" },
  "kaneo-team": { name: "The Kaneo team", role: "Kaneo" },
};

const CATEGORIES = {
  alternatives: "Alternatives",
  evergreens: "Evergreens",
  product: "Product",
  updates: "Updates",
};

/**
 * Breaks a title into groups of lines: the main clause, and a trailing
 * parenthetical kept whole so the OG title wraps the way the post's <h1> does.
 */
function layoutTitle(title, size, maxWidth) {
  const parenthetical = title.match(/^(.*\S)\s+(\(.+\))$/);
  if (!parenthetical) return [wrap(title, size, maxWidth, MAX_TITLE_LINES)];

  return [
    wrap(parenthetical[1], size, maxWidth, MAX_TITLE_LINES - 1),
    wrap(parenthetical[2], size, maxWidth, 1),
  ];
}

/** A group whose final line is a lone word reads as a typesetting mistake. */
function hasOrphan(groups) {
  return groups.some(
    (lines) =>
      lines.length > 1 && lines[lines.length - 1].split(" ").length === 1,
  );
}

/** Picks the largest size that fits the line budget without orphaning a word. */
function fitTitle(title, maxWidth) {
  let fallback = null;

  for (let size = TITLE_MAX_SIZE; size >= TITLE_MIN_SIZE; size -= 2) {
    const groups = layoutTitle(title, size, maxWidth);
    const lines = groups.flat();
    if (lines.length > MAX_TITLE_LINES) continue;

    fallback ??= { size, lines };
    if (!hasOrphan(groups)) return { size, lines };
  }

  return (
    fallback ?? {
      size: TITLE_MIN_SIZE,
      lines: layoutTitle(title, TITLE_MIN_SIZE, maxWidth).flat(),
    }
  );
}

function buildSvg({ title, category, author }) {
  const innerWidth = WIDTH - PADDING * 2;
  const { size, lines } = fitTitle(title, innerWidth);
  const leading = Math.round(size * TITLE_LEADING_RATIO);
  const blockHeight = lines.length * leading;
  const titleTop = 315 - blockHeight / 2 + size * 0.78;

  const titleLines = lines
    .map(
      (line, index) =>
        `  <text x="${PADDING}" y="${titleTop + index * leading}" font-family="${FONT}" font-size="${size}" font-weight="500" fill="#171717" letter-spacing="-0.8">${escapeXml(line)}</text>`,
    )
    .join("\n");

  const footerY = HEIGHT - PADDING - 18;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
  <defs>
    <linearGradient id="wash" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#F5F5F5" />
      <stop offset="55%" stop-color="#FFFFFF" />
    </linearGradient>
  </defs>

  <rect width="${WIDTH}" height="${HEIGHT}" fill="#FFFFFF" />
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#wash)" />
  <rect x="0" y="0" width="${WIDTH}" height="6" fill="#171717" />

${logoMarkup(PADDING, PADDING, 38)}
  <text x="${WIDTH - PADDING}" y="${PADDING + 26}" text-anchor="end" font-family="${FONT}" font-size="22" font-weight="500" fill="#737373" letter-spacing="1.5">${escapeXml(category.toUpperCase())}</text>

${titleLines}

  <rect x="${PADDING}" y="${footerY - 52}" width="${innerWidth}" height="1" fill="#E5E5E5" />
  <text x="${PADDING}" y="${footerY}" font-family="${FONT}" font-size="26" font-weight="500" fill="#171717">${escapeXml(author.name)}</text>
  <text x="${PADDING}" y="${footerY + 30}" font-family="${FONT}" font-size="22" fill="#737373">${escapeXml(author.role)}</text>
  <text x="${WIDTH - PADDING}" y="${footerY + 15}" text-anchor="end" font-family="${FONT}" font-size="24" font-weight="500" fill="#737373">kaneo.app</text>
</svg>
`;
}

function rasterise(svgPath, pngPath) {
  const attempts = [
    [
      "rsvg-convert",
      ["-w", String(WIDTH), "-h", String(HEIGHT), "-o", pngPath, svgPath],
    ],
    ["magick", [svgPath, "-resize", `${WIDTH}x${HEIGHT}`, pngPath]],
    ["convert", [svgPath, "-resize", `${WIDTH}x${HEIGHT}`, pngPath]],
  ];

  for (const [command, args] of attempts) {
    try {
      execFileSync(command, args, { stdio: "pipe" });
      return command;
    } catch {}
  }

  return null;
}

const only = new Set(process.argv.slice(2));
fs.mkdirSync(SVG_DIR, { recursive: true });
fs.mkdirSync(PNG_DIR, { recursive: true });

const files = fs
  .readdirSync(CONTENT_DIR)
  .filter((file) => file.endsWith(".md"))
  .filter((file) => only.size === 0 || only.has(file.replace(/\.md$/, "")));

if (files.length === 0) {
  console.error("No matching posts found.");
  process.exit(1);
}

let rasterised = 0;

for (const file of files) {
  const slug = file.replace(/\.md$/, "");
  const data = readFrontmatter(path.join(CONTENT_DIR, file));
  const author = AUTHORS[data.author];
  const category = CATEGORIES[data.category];

  if (!author) throw new Error(`${file}: unknown author "${data.author}"`);
  if (!category)
    throw new Error(`${file}: unknown category "${data.category}"`);

  const svgPath = path.join(SVG_DIR, `${slug}.svg`);
  const pngPath = path.join(PNG_DIR, `${slug}.png`);

  fs.writeFileSync(svgPath, buildSvg({ title: data.title, category, author }));

  const tool = rasterise(svgPath, pngPath);
  if (tool) {
    rasterised += 1;
    console.log(`${slug}.png  (${tool})`);
  } else {
    console.log(`${slug}.svg  (no rasteriser found, PNG not written)`);
  }
}

if (rasterised < files.length) {
  console.log(
    "\nInstall rsvg-convert (librsvg) or ImageMagick to produce the PNGs, then rerun.",
  );
}
