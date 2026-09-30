import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const siteDir = fileURLToPath(new URL("../", import.meta.url));
const outDir = path.join(siteDir, "out");
const docsDir = path.resolve(siteDir, "../docs");
const origin = "https://kaneo.app";
const failures = new Set();

function check(condition, message) {
  if (!condition) failures.add(message);
}

// This checks Next's generated HTML, not arbitrary user-provided markup.
function decode(value) {
  const entities = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
  return value.replace(
    /&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos);/gi,
    (_, entity) => {
      if (entity.startsWith("#x"))
        return String.fromCodePoint(Number.parseInt(entity.slice(2), 16));
      if (entity.startsWith("#"))
        return String.fromCodePoint(Number(entity.slice(1)));
      return entities[entity];
    },
  );
}

function tags(html, name) {
  return [...html.matchAll(new RegExp(`<${name}\\b([^>]*)>`, "gi"))].map(
    (match) =>
      Object.fromEntries(
        [...match[1].matchAll(/([\w:-]+)="([^"]*)"/g)].map((attr) => [
          attr[1],
          decode(attr[2]),
        ]),
      ),
  );
}

function targetFile(pathname) {
  const relative = decodeURIComponent(pathname).replace(/^\//, "");
  const isDocs = relative === "docs" || relative.startsWith("docs/");
  const base = path.join(
    isDocs ? docsDir : outDir,
    isDocs ? relative.slice(4) : relative,
  );
  const candidates = isDocs
    ? [`${base}.mdx`, path.join(base, "index.mdx"), base]
    : [`${base}.html`, path.join(base, "index.html"), base];
  return candidates.find(
    (candidate) => existsSync(candidate) && statSync(candidate).isFile(),
  );
}

const sitemapFile = path.join(outDir, "sitemap-pages.xml");
if (!existsSync(sitemapFile)) {
  console.error("Build the site before running seo:check.");
  process.exit(1);
}

const sitemap = readFileSync(sitemapFile, "utf8");
const urls = [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map((match) =>
  decode(match[1]),
);
check(urls.length > 0, "The page sitemap is empty.");
check(
  new Set(urls).size === urls.length,
  "The sitemap contains duplicate URLs.",
);
const titles = new Map();
const linkedPages = new Set();

for (const url of urls) {
  const location = new URL(url);
  check(location.origin === origin, `Unexpected sitemap origin: ${url}`);
  const file = targetFile(location.pathname);
  if (!file?.endsWith(".html")) {
    failures.add(`Sitemap page has no exported HTML: ${url}`);
    continue;
  }
  const html = readFileSync(file, "utf8");
  const head = html.match(/<head>([\s\S]*?)<\/head>/i)?.[1] ?? "";
  const metas = tags(head, "meta");
  const meta = (name) =>
    metas.find((tag) => tag.name === name || tag.property === name)?.content;
  const title = decode(head.match(/<title>(.*?)<\/title>/i)?.[1] ?? "");
  const canonicals = tags(head, "link").filter(
    (tag) => tag.rel === "canonical",
  );

  check(Boolean(title.trim()), `Missing title: ${url}`);
  check(!titles.has(title), `Duplicate title: ${url} and ${titles.get(title)}`);
  titles.set(title, url);
  check(Boolean(meta("description")?.trim()), `Missing description: ${url}`);
  check(
    canonicals.length === 1 && new URL(canonicals[0].href, origin).href === url,
    `Canonical differs from sitemap URL: ${url}`,
  );
  check(
    !metas.some(
      (tag) =>
        ["robots", "googlebot"].includes(tag.name) &&
        /noindex/i.test(tag.content),
    ),
    `Sitemap page is noindex: ${url}`,
  );
  check(
    Boolean(meta("og:url")) && new URL(meta("og:url"), origin).href === url,
    `Wrong Open Graph URL: ${url}`,
  );
  for (const name of [
    "og:title",
    "twitter:title",
    "og:description",
    "twitter:description",
  ]) {
    check(Boolean(meta(name)?.trim()), `Missing ${name}: ${url}`);
  }
  check(
    meta("og:title") === title,
    `Open Graph title differs from page title: ${url}`,
  );
  check(
    meta("twitter:title") === title ||
      `${meta("twitter:title")} | Kaneo` === title,
    `Twitter title differs from page title: ${url}`,
  );
  for (const name of ["og:description", "twitter:description"]) {
    check(
      meta(name) === meta("description"),
      `${name} differs from page description: ${url}`,
    );
  }
  for (const name of ["og:image", "twitter:image"]) {
    const image = meta(name);
    check(Boolean(image), `Missing ${name}: ${url}`);
    if (image && new URL(image, origin).origin === origin) {
      check(
        Boolean(targetFile(new URL(image, origin).pathname)),
        `Missing social image ${image}: ${url}`,
      );
    }
  }
  check(tags(html, "h1").length === 1, `Expected one H1: ${url}`);
  for (const match of html.matchAll(
    /<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g,
  )) {
    try {
      JSON.parse(match[1]);
    } catch {
      failures.add(`Invalid JSON-LD: ${url}`);
    }
  }
  // Ignore script bodies so hydration payloads cannot masquerade as links.
  const body = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "");
  for (const anchor of tags(body, "a")) {
    if (!anchor.href) continue;
    const target = new URL(anchor.href, url);
    if (target.origin !== origin) continue;
    check(
      Boolean(targetFile(target.pathname)),
      `Broken internal link ${target.pathname} on ${location.pathname}`,
    );
    if (target.pathname !== location.pathname)
      linkedPages.add(`${origin}${target.pathname}`);
  }
}

for (const url of urls)
  check(linkedPages.has(url), `No internal links to sitemap page: ${url}`);

if (failures.size) {
  console.error([...failures].join("\n"));
  process.exit(1);
}
console.log(
  `SEO checks passed for ${urls.length} pages: metadata, canonicals, social images, headings, JSON-LD, and internal links.`,
);
