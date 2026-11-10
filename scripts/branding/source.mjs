import { parse } from "@babel/parser";
import { readFileSync } from "node:fs";
import { brandText } from "../../branding/index.cjs";

const catalog = JSON.parse(
  readFileSync(new URL("../../i18n/en-US.json", import.meta.url), "utf8"),
);

export function catalogKey(value) {
  if (typeof value !== "string" || !value.includes(":")) return false;
  const [namespace, key] = value.split(":");
  return (
    key
      .split(".")
      .reduce(
        (item, part) =>
          item && Object.hasOwn(item, part) ? item[part] : undefined,
        catalog[namespace],
      ) !== undefined
  );
}

export function brandingBindings(source, filename) {
  const ast = syntax(source, filename);
  const bindings = new Set();
  walk(ast, (node) => {
    if (
      node.type !== "ImportDeclaration" ||
      node.source.value !== "@kaneo/branding"
    )
      return;
    for (const specifier of node.specifiers)
      if (specifier.imported?.name === "brandText")
        bindings.add(specifier.local.name);
  });
  walk(ast, (node) => {
    const patterns =
      node.type === "VariableDeclarator"
        ? [node.id]
        : /Function|Method/.test(node.type)
          ? [...(node.params ?? []), node.id]
          : node.type === "CatchClause"
            ? [node.param]
            : [];
    function removeBinding(pattern) {
      if (!pattern) return;
      if (pattern.type === "Identifier") bindings.delete(pattern.name);
      else if (pattern.type === "AssignmentPattern")
        removeBinding(pattern.left);
      else if (pattern.type === "RestElement") removeBinding(pattern.argument);
      else if (pattern.type === "ArrayPattern")
        pattern.elements.forEach(removeBinding);
      else if (pattern.type === "ObjectPattern")
        pattern.properties.forEach((property) =>
          removeBinding(
            property.type === "RestElement"
              ? property.argument
              : property.value,
          ),
        );
    }
    patterns.forEach(removeBinding);
  });
  return bindings;
}

export const prohibited = /kaneo|caneo|kenya|id6828574501/gi;

export function walk(node, visit, parent) {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const child of node) walk(child, visit, parent);
    return;
  }
  if (node.type) visit(node, parent);
  for (const [key, value] of Object.entries(node)) {
    if (!["loc", "comments", "tokens", "errors"].includes(key))
      walk(value, visit, node);
  }
}

export function syntax(source, filename) {
  return parse(source, {
    sourceType: "unambiguous",
    plugins: [
      ...(/\.[cm]?tsx?$/.test(filename)
        ? [["typescript", { dts: /\.d\.[cm]?ts$/.test(filename) }]]
        : []),
      "jsx",
    ],
  });
}

// These are syntactic positions, not line-wide exclusions.
export function technical(node, parent) {
  if (!parent) return false;
  if (
    parent.type === "CallExpression" &&
    (parent.callee?.name === "t" ||
      (parent.callee?.object?.name === "i18n" &&
        parent.callee?.property?.name === "t")) &&
    parent.arguments[0] === node &&
    catalogKey(node.value)
  )
    return true;
  if (/^(Import|Export)/.test(parent.type) && parent.source === node)
    return true;
  if (
    [
      "ObjectProperty",
      "ObjectMethod",
      "MemberExpression",
      "OptionalMemberExpression",
      "TSLiteralType",
    ].includes(parent.type) &&
    (parent.key === node || parent.property === node || parent.literal === node)
  )
    return true;
  return false;
}

export function copyNodes(source, filename) {
  const nodes = [];
  walk(syntax(source, filename), (node, parent) => {
    if (technical(node, parent)) return;
    if (node.type === "StringLiteral" || node.type === "JSXText") {
      nodes.push({ node, parent, value: node.value });
    } else if (node.type === "TemplateElement") {
      nodes.push({ node, parent, value: node.value.cooked ?? node.value.raw });
    }
  });
  return nodes;
}

export function foldBrandCalls(source, filename) {
  const bindings = brandingBindings(source, filename);
  const edits = [];
  walk(syntax(source, filename), (node) => {
    if (
      node.type === "CallExpression" &&
      bindings.has(node.callee?.name) &&
      node.arguments.length === 1 &&
      node.arguments[0].type === "StringLiteral"
    ) {
      edits.push({
        start: node.start,
        end: node.end,
        text: JSON.stringify(brandText(node.arguments[0].value)),
      });
    }
  });
  let output = source;
  for (const edit of edits.sort((a, b) => b.start - a.start))
    output = output.slice(0, edit.start) + edit.text + output.slice(edit.end);
  return output;
}

export function brandCopyPlugin() {
  return {
    name: "fork-branding-copy",
    transform(source, id) {
      const filename = id.split("?")[0];
      if (
        /\.[cm]?[jt]sx?$/.test(filename) &&
        source.includes("@kaneo/branding")
      )
        return foldBrandCalls(source, filename);
    },
  };
}

/** Site compiler adapter: modify static copy, preserving imports, keys and code. */
export function transformCopy(source, filename) {
  const edits = [];
  for (const { node, parent, value } of copyNodes(source, filename)) {
    // Lowercase protocol identifiers remain intact. Prose and destinations change.
    if (!/kaneo/i.test(value)) continue;
    const next = brandText(value);
    if (next === value) continue;
    const text =
      node.type === "StringLiteral"
        ? parent?.type === "JSXAttribute"
          ? `{${JSON.stringify(next)}}`
          : JSON.stringify(next)
        : node.type === "TemplateElement"
          ? next
              .replace(/\\/g, "\\\\")
              .replace(/`/g, "\\`")
              .replace(/\$\{/g, "\\${")
          : next
              .replace(/&/g, "&amp;")
              .replace(/</g, "&lt;")
              .replace(/\{/g, "&#123;")
              .replace(/\}/g, "&#125;");
    edits.push({ start: node.start, end: node.end, text });
  }
  let output = source;
  for (const edit of edits.sort((a, b) => b.start - a.start)) {
    output = output.slice(0, edit.start) + edit.text + output.slice(edit.end);
  }
  return output;
}
