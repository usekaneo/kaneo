import { findClassSelectors } from "./css-class-selectors.js";
import { isTailwindClass } from "./tailwind-class.js";

const SHOWN_SELECTORS = 5;

export function findHostCollisions(css: string): string[] {
  const seen = new Set<string>();
  const collisions: string[] = [];
  for (const { selector, name } of findClassSelectors(css)) {
    if (seen.has(name)) continue;
    seen.add(name);
    if (isTailwindClass(name)) collisions.push(selector);
  }
  return collisions;
}

export function tailwindPrefixFor(pluginId: string): string {
  return pluginId.toLowerCase().replace(/[^a-z]/g, "") || "plugin";
}

export function describeHostCollisions(
  file: string,
  selectors: ReadonlyArray<string>,
  pluginId: string,
): string {
  const prefix = tailwindPrefixFor(pluginId);
  const shown = selectors.slice(0, SHOWN_SELECTORS).join(", ");
  const hidden = selectors.length - SHOWN_SELECTORS;
  const more = hidden > 0 ? ` and ${hidden} more` : "";
  return `${file} defines class selectors that collide with Kaneo's own Tailwind classes: ${shown}${more}. Plugin CSS loads into Kaneo's page, so these rules override Kaneo's layout. Set a Tailwind prefix with @import "tailwindcss/theme.css" layer(theme) prefix(${prefix}); and write classes as ${prefix}:flex, or use namespaced class names such as .${prefix}-panel.`;
}
