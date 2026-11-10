import { createRequire } from "node:module";
import postcss from "postcss";
import { execFileSync } from "node:child_process";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  brand,
  brandResources,
  brandText,
  assertReleaseBrand,
} from "../../branding/index.cjs";
import {
  assetRoots,
  digest,
  filesUnder,
  media,
  root,
  safePath,
} from "./assets.mjs";
import { brandMarkdown } from "./markdown.mjs";
import { packageMetadata, registryMetadata } from "./prepare-package.mjs";
import { isOmittedDoc, brandDocsConfig } from "./docs-config.mjs";
import { brandInstaller } from "./installer.mjs";
import { brandHtml } from "./html.mjs";
import {
  brandingBindings,
  catalogKey,
  copyNodes,
  prohibited,
  transformCopy,
} from "./source.mjs";

const require = createRequire(import.meta.url);

const code = /\.[cm]?[jt]sx?$/;
const text = /\.(json|html|mdx?|txt|xml|webmanifest|svg|sh|ps1|css)$/;
const testFile =
  /(?:\.test\.|\.spec\.|__tests__|test-support|\/previews\/|\/tests\/|routeTree\.gen)/;
const roots = /^(?:apps\/|packages\/|i18n\/)/;
const legal = /(?:^|\/)(?:LICENSE|COPYING|NOTICE)(?:\.|$)/i;

export function exceptionValue(value) {
  const pairs = Object.entries(brand)
    .filter(([, item]) => typeof item === "string" && item)
    .map(([key, item]) => [
      item,
      `{{${key === "name" ? "productName" : key}}}`,
    ]);
  for (const key of ["publicUrl", "clientUrl", "docsUrl", "assetsUrl"])
    pairs.push([new URL(brand[key]).host, `{{${key}Host}}`]);
  pairs.push([
    new URL(brand.repositoryUrl).pathname.replace(/^\/|\/$/g, "") ||
      "OWNER/REPOSITORY",
    "{{repositoryId}}",
  ]);
  let result = value;
  const canonical = new Map();
  for (const [source, target] of pairs) {
    if (canonical.has(source))
      result = result.split(target).join(canonical.get(source));
    else canonical.set(source, target);
  }
  for (const [source, target] of [...canonical].sort(
    (a, b) => b[0].length - a[0].length,
  ))
    result = result
      .split(/(\{\{\w+\}\})/g)
      .map((part) =>
        part.startsWith("{{") ? part : part.split(source).join(target),
      )
      .join("");
  return result;
}

export function matches(value) {
  return [
    ...value
      .replace(/@(?:kaneo|kenya)\/[a-z0-9_./*-]+/gi, (token) =>
        " ".repeat(token.length),
      )
      .matchAll(prohibited),
  ].map((match) => ({ term: match[0], offset: match.index }));
}

export function scanCode(source, filename) {
  const findings = [];
  const bindings = brandingBindings(source, filename);
  for (const { node, parent, value } of copyNodes(source, filename)) {
    // Validate the rendered value of explicitly adapted application-owned copy.
    const effective =
      parent?.type === "CallExpression" && bindings.has(parent.callee?.name)
        ? brandText(value)
        : value;
    for (const match of matches(effective)) {
      findings.push({
        file: filename,
        line: node.loc.start.line,
        term: match.term,
        value,
        rule: "copy",
      });
    }
  }
  return findings;
}

export function scanStyles(source, filename) {
  const findings = [];
  const root = postcss.parse(source, { from: filename });
  const check = (node, value, label) => {
    const decoded = value.replace(
      /\\([a-f0-9]{1,6})[ \t]?|\\([^\r\n])/gi,
      (_match, hex, char) =>
        hex
          ? String.fromCodePoint(
              Math.min(Number.parseInt(hex, 16) || 65533, 1114111),
            )
          : char,
    );
    for (const match of matches(decoded))
      findings.push({
        file: filename,
        line: node.source.start.line,
        term: match.term,
        value: `${label}: ${value}`,
        rule: "style",
      });
  };
  root.walkDecls((node) => check(node, node.value, node.prop));
  root.walkAtRules("import", (node) => check(node, node.params, "@import"));
  return findings;
}

export function scanText(source, filename) {
  return matches(source).map((match) => ({
    file: filename,
    line: source.slice(0, match.offset).split("\n").length,
    term: match.term,
    value:
      source.split("\n")[source.slice(0, match.offset).split("\n").length - 1],
    rule: "text",
  }));
}

function scanValues(value, filename, original, key = "") {
  if (typeof value === "string")
    return matches(value).map((match) => ({
      file: filename,
      line: 1,
      term: match.term,
      value: original
        ? `${key}: ${JSON.stringify(original)}`
        : `${key}: ${JSON.stringify(value)}`,
      rule: "value",
    }));
  if (!value || typeof value !== "object") return [];
  return Object.entries(value).flatMap(([childKey, child]) =>
    scanValues(child, filename, null, key ? `${key}.${childKey}` : childKey),
  );
}

// `key.path: "text"` → `"text"`, the form a bundle keeps once it drops the namespace.
function catalogText(value) {
  return value.slice(value.indexOf(": ") + 2);
}

// Bundlers inline catalogs as JSON strings. Their keys stay upstream-compatible, so scan values.
function scanBundle(source, filename) {
  const catalogs = new Set();
  return scanCode(source, filename).flatMap((finding) => {
    if (!/^[[{]/.test(finding.value)) return [finding];
    let data;
    try {
      data = JSON.parse(finding.value);
    } catch {
      return [finding];
    }
    if (catalogs.has(finding.value)) return [];
    catalogs.add(finding.value);
    return scanValues(data, filename).map((item) => ({
      ...item,
      catalog: true,
    }));
  });
}

export async function sourceFindings() {
  // Git includes new non-ignored files, without walking dependencies or local secrets.
  const filenames = [
    ...new Set(
      execFileSync(
        "git",
        ["ls-files", "-z", "--cached", "--others", "--exclude-standard"],
        { cwd: root, maxBuffer: 20 * 1024 * 1024 },
      )
        .toString()
        .split("\0")
        .filter(Boolean),
    ),
  ];
  const findings = [];
  for (const file of filenames) {
    if (
      file.startsWith("apps/docs/") &&
      isOmittedDoc(file.slice("apps/docs/".length).replace(/\.mdx$/, ""))
    )
      continue;
    if (
      /\/(?:drizzle|scripts|testing)\//.test(file) ||
      /(?:^|\/)test-[^/]+\.[jt]sx?$/.test(file)
    )
      continue;
    if (
      /\.(md|mdx)$/.test(file) &&
      !(
        file.startsWith("apps/docs/") || file.startsWith("apps/site/content/")
      ) &&
      !file.startsWith("apps/site/content/") &&
      !/^packages\/(cli|mcp|planka-import)\/README.md$/.test(file)
    )
      continue;
    if (
      file === "i18n/schema.json" ||
      /(?:config\.[cm]?[jt]s|vite-env\.d\.ts)$/.test(file)
    )
      continue;
    if (/\/(?:tsconfig[^/]*\.json|components\.json)$/.test(file)) continue;
    if (
      !roots.test(file) ||
      testFile.test(file) ||
      legal.test(file) ||
      file.endsWith("AGENTS.md")
    )
      continue;
    if (!code.test(file) && !text.test(file)) continue;
    let source = await readFile(path.join(root, file), "utf8");
    if (file === "apps/web/index.html") source = brandHtml(source);
    if (file.endsWith(".css")) {
      findings.push(...scanStyles(source, file));
      continue;
    }
    if (file === "packages/mcp/server.json")
      source = JSON.stringify(registryMetadata(JSON.parse(source)));
    if (file === "apps/site/public/images/product/manifest.json")
      source = JSON.stringify(brandResources(JSON.parse(source)));
    if (file === "apps/mobile/app.json")
      source = JSON.stringify({
        expo: require("../../apps/mobile/app.config.js")({
          config: JSON.parse(source).expo,
        }),
      });
    if (file.endsWith("/package.json")) {
      const rawManifest = JSON.parse(source);
      const manifest = /^packages\/(cli|mcp|planka-import)\//.test(file)
        ? packageMetadata(rawManifest)
        : rawManifest;
      findings.push(
        ...scanValues(
          {
            description: manifest.description,
            homepage: manifest.homepage,
            author: manifest.author,
          },
          file,
        ),
      );
      continue;
    }
    if (/^i18n\/[a-z]{2}-[A-Z]{2}\.json$/.test(file)) {
      findings.push(...scanValues(brandResources(JSON.parse(source)), file));
    } else if (code.test(file)) {
      findings.push(
        ...scanCode(
          file.startsWith("apps/site/") && /\/(app|lib|components)\//.test(file)
            ? transformCopy(source, file)
            : source,
          file,
        ),
      );
    } else if (
      file.startsWith("apps/docs/") ||
      file.startsWith("apps/site/content/") ||
      file.startsWith("apps/site/public/cli/") ||
      /^packages\/(cli|mcp|planka-import)\/README.md$/.test(file)
    ) {
      findings.push(
        ...(file.endsWith(".json")
          ? scanValues(
              file === "apps/docs/docs.json"
                ? brandDocsConfig(JSON.parse(source))
                : brandResources(JSON.parse(source)),
              file,
            )
          : scanText(
              file.startsWith("apps/site/public/cli/")
                ? brandInstaller(source, file)
                : brandMarkdown(source),
              file,
            )),
      );
    } else if (file.endsWith(".json") || file.endsWith(".webmanifest")) {
      findings.push(
        ...scanValues(
          file.endsWith(".webmanifest")
            ? brandResources(JSON.parse(source))
            : JSON.parse(source),
          file,
        ),
      );
    } else findings.push(...scanText(source, file));
  }
  return findings;
}

export async function checkAssets(surfaces = assetRoots) {
  const inventory = JSON.parse(
    await readFile(path.join(root, "branding/asset-review.json"), "utf8"),
  );
  const seen = new Set();
  const findings = [];
  for (const dir of surfaces) {
    for (const file of await filesUnder(path.join(root, dir))) {
      if (!media.test(file)) continue;
      const relative = path.relative(root, file);
      seen.add(relative);
      const entry = inventory[relative];
      const replacement = brand.assets.find((item) => item.target === relative);
      if (replacement) {
        const bytes = await readFile(
          safePath(path.join(root, "branding"), replacement.source),
        );
        if (
          !replacement.approved ||
          digest(bytes) !== replacement.sha256 ||
          (entry?.requiresReplacement && replacement.sha256 === entry.sha256)
        )
          findings.push(`${relative}: replacement needs approval`);
      } else if (
        entry?.requiresReplacement ||
        !entry?.approved ||
        entry.sha256 !== digest(await readFile(file))
      ) {
        findings.push(`${relative}: new, changed or unapproved public asset`);
      }
    }
  }
  for (const file of Object.keys(inventory))
    if (
      surfaces.some((surface) => file.startsWith(surface + "/")) &&
      !seen.has(file)
    )
      findings.push(`${file}: stale asset review`);
  return findings;
}

export async function checkOutput(directory) {
  const full = safePath(root, directory);
  if (!(await stat(full)).isDirectory())
    throw new Error(`Missing output directory: ${directory}`);
  const files = await filesUnder(full);
  if (!files.length) throw new Error(`Empty output directory: ${directory}`);
  const findings = [];
  const exceptions = JSON.parse(
    await readFile(
      path.join(root, "branding/technical-references.json"),
      "utf8",
    ),
  );
  const reviewedCode = new Set();
  const reviewedText = new Set(
    exceptions.flatMap((item) =>
      [item.value, brandText(item.value)].map(
        (value) => `${item.file}\0${exceptionValue(value)}\0${item.term ?? ""}`,
      ),
    ),
  );
  for (const item of exceptions.filter((item) => code.test(item.file)))
    reviewedCode.add(
      `${exceptionValue(brandText(item.value))}\0${item.term ?? ""}`,
    );
  const helper = await readFile(path.join(root, "branding/index.cjs"), "utf8");
  for (const finding of scanCode(helper, "branding/index.cjs"))
    reviewedCode.add(`${exceptionValue(finding.value)}\0${finding.term}`);
  // Bundled catalogs lose their file and namespace, so match reviewed i18n values by text.
  const reviewedCatalog = new Set(
    exceptions
      .filter((item) => item.file.startsWith("i18n/"))
      .flatMap((item) =>
        [catalogText(item.value), brandText(catalogText(item.value))].map(
          (value) => `${exceptionValue(value)}\0${item.term ?? ""}`,
        ),
      ),
  );
  // Bundlers join templates and constants; each retained token needs an exact reviewed fragment.
  const covered = (finding) => {
    const value = exceptionValue(finding.value);
    const key = `${value}\0`;
    if (reviewedCode.has(key + finding.term) || reviewedCode.has(key))
      return true;
    let uncovered = value;
    for (const entry of reviewedCode) {
      const [fragment, term] = entry.split("\0");
      if (fragment.length >= 8 && (!term || term === finding.term))
        uncovered = uncovered.split(fragment).join(" ".repeat(fragment.length));
    }
    return !matches(uncovered).some((match) => match.term === finding.term);
  };
  const compiled =
    /^(?:packages\/[^/]+\/dist|\.cache\/npm\/[^/]+|apps\/(?:web\/dist|site\/(?:\.next|out)))(?:\/|$)/.test(
      directory,
    );
  const exported = /^apps\/site\/out(?:\/|$)/.test(directory);
  const inventory = JSON.parse(
    await readFile(path.join(root, "branding/asset-review.json"), "utf8"),
  );
  const forbidden = new Set(
    Object.values(inventory)
      .filter((entry) => entry.requiresReplacement)
      .map((entry) => entry.sha256),
  );
  const approved = new Set([
    ...Object.values(inventory)
      .filter((entry) => entry.approved && !entry.requiresReplacement)
      .map((entry) => entry.sha256),
    ...brand.assets
      .filter((entry) => entry.approved)
      .map((entry) => entry.sha256),
  ]);
  for (const file of files) {
    const relative = path.relative(root, file);
    if (legal.test(relative)) continue;
    if (file.endsWith(".map"))
      throw new Error(`Public source map: ${relative}`);
    if (
      media.test(file) &&
      (!approved.has(digest(await readFile(file))) ||
        forbidden.has(digest(await readFile(file))))
    )
      findings.push({
        file: relative,
        line: 1,
        rule: "unapproved-output-asset",
        term: path.basename(file),
      });
    if (!code.test(file) && !text.test(file)) continue;
    const source = await readFile(file, "utf8");
    if (
      file.endsWith(path.join("fork-branding", "index.cjs")) &&
      source === helper
    )
      continue;
    if (file.endsWith(".css")) {
      findings.push(...scanStyles(source, relative));
      continue;
    }
    const scanned = code.test(file)
      ? scanBundle(source, relative)
      : /\.(json|webmanifest)$/.test(file)
        ? scanValues(JSON.parse(source), relative)
        : scanText(source, relative);
    // Compilers lose source paths; retain only exact reviewed technical values. Source CI still checks their original locations.
    findings.push(
      ...scanned.filter((finding) => {
        if (finding.catalog) {
          const value = exceptionValue(catalogText(finding.value));
          return (
            !reviewedCatalog.has(`${value}\0${finding.term}`) &&
            !reviewedCatalog.has(`${value}\0`)
          );
        }
        // Minifiers rename `t` and keep env placeholders; whole catalog keys and env names stay technical.
        if (compiled && code.test(file))
          return (
            !covered(finding) &&
            !catalogKey(finding.value) &&
            !/^KANEO_[A-Z0-9_]+$/.test(finding.value)
          );
        // Static exports inline compiled code into HTML and RSC payloads.
        if (exported && /\.(html|txt)$/.test(file) && covered(finding))
          return false;
        const sourceFile = relative
          .replace(/^\.cache\/npm\/([^/]+)\//, "packages/$1/")
          .replace(/^apps\/web\/dist\//, "apps/web/public/")
          .replace(/^apps\/site\/out\//, "apps/site/public/")
          .replace(/^\.cache\/branded-docs(-test-[^/]+)?\//, "apps/docs/");
        const key = `${sourceFile}\0${exceptionValue(finding.value)}\0`;
        return !reviewedText.has(key + finding.term) && !reviewedText.has(key);
      }),
    );
  }
  return findings;
}

export const validateReleaseConfig = assertReleaseBrand;

async function main() {
  const args = process.argv.slice(2);
  if (
    args.some(
      (arg) =>
        !["--release", "--output"].includes(arg) &&
        args[args.indexOf(arg) - 1] !== "--output",
    )
  )
    throw new Error("Usage: check.mjs [--release] [--output directory]");
  if (args.includes("--release")) validateReleaseConfig();
  const outputIndex = args.indexOf("--output");
  if (outputIndex >= 0 && !args[outputIndex + 1])
    throw new Error("--output requires a directory");
  const findings =
    outputIndex >= 0
      ? await checkOutput(args[outputIndex + 1])
      : await sourceFindings();
  const exceptions = JSON.parse(
    await readFile(
      path.join(root, "branding/technical-references.json"),
      "utf8",
    ),
  );
  const used = new Set();
  const reviewed = new Map();
  for (let index = 0; index < exceptions.length; index++) {
    const item = exceptions[index];
    if (
      typeof item.file !== "string" ||
      typeof item.value !== "string" ||
      !item.reason?.trim()
    )
      throw new Error(`Invalid technical exception at index ${index}`);
    reviewed.set(
      `${item.file}\0${exceptionValue(item.value)}\0${item.term ?? ""}`,
      index,
    );
  }
  const remaining = findings.filter((finding) => {
    if (typeof finding.value !== "string") return true;
    const prefix = `${finding.file}\0${exceptionValue(finding.value)}\0`;
    const index = reviewed.get(prefix + finding.term) ?? reviewed.get(prefix);
    if (index === undefined) return true;
    used.add(index);
    return false;
  });
  if (outputIndex < 0) {
    for (let index = 0; index < exceptions.length; index++)
      if (!used.has(index))
        remaining.push({
          file: exceptions[index].file,
          line: 1,
          rule: "stale-exception",
          term: exceptions[index].value,
        });
  }
  for (const finding of remaining)
    console.error(
      `${finding.file}:${finding.line}: ${finding.rule}: ${finding.term}`,
    );
  const assets = await checkAssets();
  for (const finding of assets) console.error(finding);
  console.log(
    `Branding check: ${remaining.length} text findings, ${assets.length} asset findings`,
  );
  process.exitCode = remaining.length || assets.length ? 1 : 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`Branding check could not complete: ${error.message}`);
    process.exitCode = 2;
  });
}
