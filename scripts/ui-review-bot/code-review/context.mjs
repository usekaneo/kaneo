import path from "node:path";
import { command } from "../core.mjs";

export const sourcePath = (value) =>
  typeof value === "string" &&
  value.length < 240 &&
  !value.startsWith("/") &&
  !value.split("/").includes("..") &&
  !/[\p{Cc}\\:]/u.test(value) &&
  /\.(?:[cm]?[jt]sx?|json|sql)$/.test(value) &&
  !/(?:^|\/)(?:package-lock\.json|pnpm-lock|.*\.min\.js|.*\.gen\.ts|openapi\.json|.*secret.*|credentials.*)$/.test(
    value,
  );

export function changedLines(patch) {
  const lines = new Set();
  let current = 0;
  for (const line of patch.split("\n")) {
    const hunk = line.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
    if (hunk) current = Number(hunk[1]);
    else if (line.startsWith("+++")) continue;
    else if (line.startsWith("+")) lines.add(current++);
    else if (line.startsWith("-")) lines.add(Math.max(1, current));
    else if (line.startsWith(" ")) current++;
  }
  return [...lines];
}

export function excerpt(file, content, center = 1, radius = 45) {
  const lines = content.split("\n");
  const start = Math.max(0, center - radius - 1);
  const end = Math.min(lines.length, center + radius);
  return {
    path: file,
    start: start + 1,
    end,
    totalLines: lines.length,
    text: lines
      .slice(start, end)
      .map((line, i) => `${start + i + 1}: ${line}`)
      .join("\n")
      .slice(0, 12_000),
  };
}

export class Snapshot {
  constructor(root, base, head) {
    if (![base, head].every((s) => /^[a-f0-9]{40}$/.test(s)))
      throw new Error("Review needs immutable commit SHAs.");
    Object.assign(this, { root, base, head });
    this.cache = new Map();
  }
  git(args) {
    return command("git", ["--no-pager", ...args], { cwd: this.root });
  }
  async read(file, revision = this.head) {
    if (!sourcePath(file)) throw new Error("Unsupported source path.");
    const key = `${revision}:${file}`;
    if (!this.cache.has(key)) {
      const value = await this.git(["show", key]).catch(() => null);
      this.cache.set(key, value);
    }
    return this.cache.get(key);
  }
  async files() {
    return (await this.git(["ls-tree", "-r", "--name-only", this.head]))
      .split("\n")
      .filter(sourcePath);
  }
  async lookup(request) {
    if (request?.kind === "file" && sourcePath(request.value)) {
      const text = await this.read(request.value);
      return text === null
        ? []
        : [
            excerpt(
              request.value,
              text,
              Number.isSafeInteger(request.line) && request.line > 0
                ? request.line
                : 1,
              75,
            ),
          ];
    }
    if (
      request?.kind === "symbol" &&
      /^[a-zA-Z_$][\w$]{2,79}$/.test(request.value)
    ) {
      const matches = await this.git([
        "grep",
        "-n",
        "-F",
        "-e",
        request.value,
        this.head,
        "--",
        "apps",
        "packages",
        "tests",
      ]).catch(() => "");
      const output = [];
      for (const hit of matches.split("\n").slice(0, 12)) {
        const match = hit.match(/^[a-f0-9]{40}:([^:]+):(\d+):/);
        if (!match || !sourcePath(match[1])) continue;
        const text = await this.read(match[1]);
        if (text !== null)
          output.push(excerpt(match[1], text, Number(match[2]), 18));
      }
      return output;
    }
    return [];
  }

  async boundaries(changed) {
    const context = [];
    const add = async (
      file,
      revision,
      line = 1,
      radius = 65,
      importance = 2,
    ) => {
      if (!sourcePath(file)) return;
      const text = await this.read(
        file,
        revision === "base" ? this.base : this.head,
      );
      const counterpart = await this.read(
        file,
        revision === "base" ? this.head : this.base,
      );
      if (revision === "base" && text === counterpart) return;
      if (
        text !== null &&
        !context.some(
          (c) =>
            c.path === file &&
            c.revision === revision &&
            Math.abs(c.start - Math.max(1, line - radius)) < 40,
        )
      )
        context.push({
          revision,
          unchangedFromBase: text === counterpart,
          importance,
          ...excerpt(file, text, line, radius),
        });
    };
    for (const item of changed) {
      const after = await this.read(item.path);
      const before = await this.read(item.path, this.base);
      const content = `${before || ""}\n${after || ""}`;
      const exports = [
        ...content.matchAll(
          /(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/g,
        ),
      ].map((m) => m[1]);
      const imports = [
        ...content.matchAll(/import\s+([^;]+?)\s+from\s*["'](\.[^"']+)["']/g),
      ]
        .map((m) => ({
          path: m[2],
          relevant: (m[1].match(/[A-Za-z_$][\w$]*/g) || []).some((name) =>
            item.patch.includes(name),
          ),
        }))
        .sort((a, b) => Number(b.relevant) - Number(a.relevant));
      const imported = new Set();
      for (const imp of imports.slice(0, 24)) {
        if (imported.has(imp.path)) continue;
        imported.add(imp.path);
        const stem = path.posix.normalize(
          path.posix.join(path.posix.dirname(item.path), imp.path),
        );
        if (stem.endsWith("/database/schema")) continue;
        for (const file of [
          stem,
          `${stem}.ts`,
          `${stem}.tsx`,
          `${stem}/index.ts`,
        ]) {
          if (!sourcePath(file) || (await this.read(file)) === null) continue;
          await add(
            file,
            "head",
            1,
            imp.relevant ? 140 : 65,
            imp.relevant ? 1 : 3,
          );
          break;
        }
      }
      const moduleName = path.posix.basename(item.path).replace(/\.[^.]+$/, "");
      const symbol =
        moduleName === "index"
          ? path.posix.basename(path.posix.dirname(item.path))
          : moduleName;
      const queryKeys = [
        ...content.matchAll(/queryKey\s*:\s*\[\s*["']([^"']+)["']/g),
      ]
        .map((m) => m[1])
        .filter(
          (key) =>
            item.patch.includes(`"${key}"`) || item.patch.includes(`'${key}'`),
        );
      for (const value of [
        ...new Set([...queryKeys, ...exports, symbol]),
      ].slice(0, 4)) {
        const hits = await this.git([
          "grep",
          "-n",
          "-F",
          "-e",
          value,
          this.head,
          "--",
          item.path.startsWith("apps/")
            ? item.path.split("/").slice(0, 2).join("/")
            : "apps",
          "packages",
        ]).catch(() => "");
        const parsed = hits
          .split("\n")
          .map((hit) => hit.match(/^[a-f0-9]{40}:([^:]+):(\d+):(.*)$/))
          .filter((m) => m && m[1] !== item.path && sourcePath(m[1]));
        if (queryKeys.includes(value)) {
          const score = (hit) =>
            (/\bqueryKey\s*:/.test(hit[3]) ? 0 : 10) +
            (hit[1].includes("/queries/") ? 0 : 1);
          parsed.sort((a, b) => score(a) - score(b));
        } else if (exports.includes(value)) {
          const call = (hit) =>
            hit[3].includes(`${value}(`) &&
            !/^\s*(?:import|export.*function|(?:async\s+)?function)\b/.test(
              hit[3],
            );
          parsed.sort((a, b) => Number(call(b)) - Number(call(a)));
        }
        for (const hit of parsed.slice(0, 8)) {
          await add(
            hit[1],
            "head",
            Number(hit[2]),
            40,
            exports.includes(value) && hit[3].includes(`${value}(`)
              ? 0.5
              : queryKeys.includes(value)
                ? 1
                : 2,
          );
          await add(hit[1], "base", Number(hit[2]), 40);
        }
      }
      const app = item.path.match(/^(apps\/[^/]+\/src)\//)?.[1];
      if (!app) continue;
      // Include app-wide middleware and the constraints of tables actually used.
      for (const revision of ["head", "base"]) {
        for (const file of [`${app}/index.ts`, `${app}/database/schema.ts`]) {
          const text = await this.read(
            file,
            revision === "base" ? this.base : this.head,
          );
          if (text === null) continue;
          const tables = [...new Set(content.match(/\b\w+Table\b/g) || [])];
          for (const [i, line] of text.split("\n").entries()) {
            if (
              file.endsWith("/index.ts")
                ? /\.use\(|authenticate\w*\(/.test(line) ||
                  line.includes(symbol)
                : tables.some((table) => line.includes(`const ${table} `))
            )
              await add(file, revision, i + 1, 35);
          }
          if (file.endsWith("/index.ts")) {
            for (const match of text.matchAll(
              /import\s*\{?\s*(authenticate\w*)[^;]*from\s*["'](\.[^"']+)["']/g,
            )) {
              const target = path.posix.normalize(
                path.posix.join(path.posix.dirname(file), `${match[2]}.ts`),
              );
              await add(target, revision, 80, 100);
            }
          }
        }
      }
    }
    const bounded = [];
    let size = 0;
    const priority = (c) =>
      /authenticate|database\/schema/.test(c.path)
        ? 0
        : /^apps\/[^/]+\/src\/index\.ts$/.test(c.path)
          ? 0
          : c.importance;
    for (const item of context.sort((a, b) => priority(a) - priority(b))) {
      if (size + item.text.length > 32_000) continue;
      bounded.push(item);
      size += item.text.length;
    }
    return bounded;
  }

  async *packets() {
    const all = (
      await this.git(["diff", "--name-only", "-z", this.base, this.head])
    )
      .split("\0")
      .filter(Boolean);
    const omitted = all.filter((file) => !sourcePath(file));
    let batches = 0;
    for (const file of all.filter(sourcePath)) {
      const patch = await this.git([
        "diff",
        "--no-ext-diff",
        "--no-textconv",
        "--unified=4",
        this.base,
        this.head,
        "--",
        file,
      ]);
      if (patch.length > 24_000 || batches >= 12) {
        omitted.push(file);
        continue;
      }
      batches++;
      yield await this.collect({
        files: [file],
        patches: new Map([[file, patch]]),
      });
    }
    yield {
      changed: [],
      omitted,
      coverage:
        "Only listed changed files were reviewed; source context is bounded.",
    };
  }

  async collect(selection = {}) {
    const all = (
      await this.git(["diff", "--name-only", "-z", this.base, this.head])
    )
      .split("\0")
      .filter(Boolean);
    const files = (selection.files || all).filter(sourcePath);
    const changed = [];
    const omitted = selection.files ? [] : all.filter((p) => !sourcePath(p));
    const context = [];
    let remaining = 55_000;
    for (const file of files) {
      const patch =
        selection.patches?.get(file) ||
        (await this.git([
          "diff",
          "--no-ext-diff",
          "--no-textconv",
          "--unified=4",
          this.base,
          this.head,
          "--",
          file,
        ]));
      const lines = changedLines(patch);
      if (patch.length > remaining || changed.length >= 20) {
        omitted.push(file);
        continue;
      }
      const after = await this.read(file);
      const before = await this.read(file, this.base);
      changed.push({ path: file, lines, patch });
      remaining -= patch.length;
      const centers = lines
        .filter((line, i) => i === 0 || line - lines[i - 1] > 45)
        .slice(0, 4);
      for (const center of centers.length ? centers : [1]) {
        if (after !== null)
          context.push({ revision: "head", ...excerpt(file, after, center) });
        if (before !== null)
          context.push({ revision: "base", ...excerpt(file, before, center) });
      }
    }
    let extra = 0;
    const testIndex = [];
    const indexedTests = new Set();
    let indexSize = 0;
    const available = await this.files();
    for (const item of changed) {
      const filename = path.posix.basename(item.path).replace(/\.[^.]+$/, "");
      const stem =
        filename === "index"
          ? path.posix.basename(path.posix.dirname(item.path))
          : filename;
      const names = new Set(
        available.filter(
          (file) =>
            file.includes(stem) && /(?:test|spec)\.[cm]?[jt]sx?$/.test(file),
        ),
      );
      const source = (await this.read(item.path)) || "";
      const symbols = [
        ...source.matchAll(/(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/g),
      ].map((m) => m[1]);
      for (const symbol of symbols.slice(0, 4)) {
        const hits = await this.git([
          "grep",
          "-l",
          "-F",
          "-e",
          symbol,
          this.head,
          "--",
          ":(glob)**/*.test.*",
          ":(glob)**/*.spec.*",
        ]).catch(() => "");
        for (const hit of hits.split("\n")) {
          const file = hit.replace(/^[a-f0-9]{40}:/, "");
          if (sourcePath(file)) names.add(file);
        }
      }
      for (const file of [...names].slice(0, 4)) {
        if (indexedTests.has(file)) continue;
        indexedTests.add(file);
        const text = await this.read(file);
        if (text === null) continue;
        const titles = text
          .split("\n")
          .flatMap((line, i) =>
            /^\s*(?:it|test|describe)(?:\.(?:only|skip|todo))?\s*\(/.test(line)
              ? [{ line: i + 1, text: line.trim().slice(0, 240) }]
              : [],
          )
          .slice(0, 60);
        const entry = { path: file, tests: titles };
        const size = JSON.stringify(entry).length;
        if (indexSize + size <= 8000) {
          testIndex.push(entry);
          indexSize += size;
        }
        if (extra < 12_000) {
          const chunk = { revision: "head", ...excerpt(file, text, 1, 100) };
          context.push(chunk);
          extra += chunk.text.length;
        }
      }
    }

    for (const item of changed) {
      const text = await this.read(item.path);
      if (!text) continue;
      const imports = [
        ...text.matchAll(/(?:from\s*|import\s*)["'](\.[^"']+)["']/g),
      ].map((m) => m[1]);
      // Always include route/middleware boundaries when a controller changes.
      if (item.path.includes("/controllers/"))
        imports.unshift("../index", "../schema");
      for (const imp of imports.slice(0, 6)) {
        const stem = path.posix.normalize(
          path.posix.join(path.posix.dirname(item.path), imp),
        );
        for (const name of [
          stem,
          `${stem}.ts`,
          `${stem}.tsx`,
          `${stem}/index.ts`,
        ]) {
          if (
            !sourcePath(name) ||
            context.some((c) => c.path === name && c.revision === "head")
          )
            continue;
          const content = await this.read(name);
          if (content === null) continue;
          const chunk = { revision: "head", ...excerpt(name, content, 1, 75) };
          if (extra + chunk.text.length <= 16_000) {
            context.push(chunk);
            extra += chunk.text.length;
          }
          break;
        }
      }
    }
    const bounded = [];
    let size = 0;
    for (const item of context) {
      if (size + item.text.length > 40_000) continue;
      bounded.push(item);
      size += item.text.length;
    }
    return {
      base: this.base,
      head: this.head,
      changed,
      context: bounded,
      boundaries: await this.boundaries(changed),
      testIndex,
      omitted,
      coverage:
        "Bounded source excerpts; tests have not been executed. Omitted files and unshown lines are not reviewed.",
    };
  }

  async resolveCitation(ref) {
    if (
      !ref ||
      !sourcePath(ref.path) ||
      !Number.isSafeInteger(ref.line) ||
      ref.line < 1 ||
      typeof ref.quote !== "string" ||
      ref.quote.trim().length < 6 ||
      ref.quote.length > 1000 ||
      (ref.revision !== undefined && !["base", "head"].includes(ref.revision))
    )
      return false;
    const text = await this.read(
      ref.path,
      ref.revision === "base" ? this.base : this.head,
    );
    if (text === null) return false;
    const lines = text.split("\n");
    const quoted = ref.quote
      .trim()
      .split("\n")
      .map((line) => line.trim());
    if (quoted.length > 20) return false;
    const variants = [quoted];
    if (quoted.every((line) => /^[+-]/.test(line)))
      variants.push(quoted.map((line) => line.slice(1).trim()));
    let matches = [];
    for (const variant of variants) {
      matches = [];
      for (let i = 0; i < lines.length; i++) {
        if (variant.every((line, j) => lines[i + j]?.trim() === line))
          matches.push(i + 1);
      }
      if (matches.length) break;
    }
    // Accept an exact fragment of a source line, never a paraphrase or fuzzy match.
    if (!matches.length && quoted.length === 1 && quoted[0].length >= 20) {
      matches = lines.flatMap((line, index) =>
        line.includes(quoted[0]) ? [index + 1] : [],
      );
    }
    const line = matches.includes(ref.line)
      ? ref.line
      : matches.length === 1
        ? matches[0]
        : null;
    return line
      ? {
          path: ref.path,
          line,
          quote: lines.slice(line - 1, line - 1 + quoted.length).join("\n"),
          revision: ref.revision || "head",
        }
      : false;
  }

  async citation(ref) {
    return Boolean(await this.resolveCitation(ref));
  }
}
