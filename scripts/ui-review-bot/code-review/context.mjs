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

  async collect() {
    const all = (
      await this.git(["diff", "--name-only", "-z", this.base, this.head])
    )
      .split("\0")
      .filter(Boolean);
    const files = all.filter(sourcePath);
    const changed = [];
    const omitted = all.filter((p) => !sourcePath(p));
    const context = [];
    let remaining = 55_000;
    for (const file of files) {
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
    const available = await this.files();
    for (const item of changed) {
      const stem = path.posix.basename(item.path).replace(/\.[^.]+$/, "");
      const related = available.filter(
        (file) =>
          file.includes(stem) && /(?:test|spec)\.[cm]?[jt]sx?$/.test(file),
      );
      for (const file of related.slice(0, 2)) {
        const text = await this.read(file);
        if (text !== null && extra < 12_000) {
          const chunk = { revision: "head", ...excerpt(file, text, 1, 150) };
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
