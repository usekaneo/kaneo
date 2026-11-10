/**
 * Renders the client-safe permissions mirror
 * (`apps/web/src/lib/shared/permissions.ts`) from the code-authoritative
 * catalogue in `./rbac-catalogue`.
 *
 * Pure data in, file text out — no drizzle, no postgres — so both the
 * generator CLI and the drift test can use it. Run
 * `bun run db:permissions` from the repo root after editing the catalogue.
 */
import {
  PERMISSIONS,
  PERMISSION_CATALOGUE,
  PERMISSION_CATEGORIES,
  SYSTEM_ROLES,
  SYSTEM_ROLE_PERMISSIONS,
  SUPPORT_LEAD_EXTRA_PERMISSIONS,
  WORKSPACE_ADMIN_PERMISSIONS,
} from "./rbac-catalogue";

const nameByValue = new Map<string, string>(
  Object.entries(PERMISSIONS).map(([name, value]) => [value, name]),
);

function ref(value: string): string {
  const name = nameByValue.get(value);
  if (!name)
    throw new Error(`permissions-mirror: unknown permission value ${value}`);
  return `PERMISSIONS.${name}`;
}

function renderPermissionsBlock(): string {
  const categoryByKey = new Map<string, string>(
    PERMISSION_CATALOGUE.map((entry) => [entry.key, entry.category]),
  );
  const lines: string[] = [];
  let lastCategory: string | null = null;
  // Source-object order, so ALL_PERMISSIONS (Object.values) keeps its order.
  for (const [name, value] of Object.entries(PERMISSIONS)) {
    const category = categoryByKey.get(value);
    if (!category)
      throw new Error(`permissions-mirror: no catalogue category for ${value}`);
    if (category !== lastCategory) {
      lastCategory = category;
      if (lines.length > 0) lines.push("");
      lines.push(`  // ${category}`);
    }
    lines.push(`  ${name}: '${value}',`);
  }
  return lines.join("\n");
}

function renderRefList(values: readonly string[], indent = "  "): string {
  return values.map((value) => `${indent}${ref(value)},`).join("\n");
}

/**
 * Render the full mirror file. Byte-stable: the drift test asserts the
 * committed file equals this output exactly.
 */
export function renderPermissionsMirror(): string {
  const contributor = SYSTEM_ROLE_PERMISSIONS.contributor
    .map((p) => `${ref(p)},`)
    .join("\n    ");

  return `/**
 * Client-safe mirror of the RBAC permission catalogue.
 *
 * GENERATED — do not edit by hand. Edit \`packages/db/src/rbac-catalogue.ts\`
 * then run \`bun run db:permissions\` from the repo root.
 *
 * The widget/portal client bundles can't import \`@quackback/db\` (it drags in
 * postgres), so the catalogue is projected here as plain data for the admin
 * UI. A drift test (permissions-catalogue-drift.test.ts) asserts this stays
 * identical to the \`@quackback/db\` source of truth: edit the catalogue there
 * first, then regenerate here.
 */

export const PERMISSIONS = {
${renderPermissionsBlock()}
} as const

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS]

export const ALL_PERMISSIONS = Object.values(PERMISSIONS) as PermissionKey[]

export const PERMISSION_CATEGORIES = [
${PERMISSION_CATEGORIES.map((category) => `  '${category}',`).join("\n")}
] as const

export type PermissionCategory = (typeof PERMISSION_CATEGORIES)[number]

// --------------------------------------------------------------- presets ---
// Projected from @quackback/db (the drift test enforces equality). The policy
// layer resolves an actor's permissions from these, and the read-only Roles UI
// renders them, so they must be client-safe.

export const SYSTEM_ROLES = {
${Object.entries(SYSTEM_ROLES)
  .map(([name, value]) => `  ${name}: '${value}',`)
  .join("\n")}
} as const

export type SystemRoleKey = (typeof SYSTEM_ROLES)[keyof typeof SYSTEM_ROLES]

export const WORKSPACE_ADMIN_PERMISSIONS: readonly PermissionKey[] = [
${renderRefList(WORKSPACE_ADMIN_PERMISSIONS)}
]

export const SUPPORT_LEAD_EXTRA_PERMISSIONS: readonly PermissionKey[] = [
${renderRefList(SUPPORT_LEAD_EXTRA_PERMISSIONS)}
]

export const SYSTEM_ROLE_PERMISSIONS: Record<SystemRoleKey, PermissionKey[]> = {
  owner: ALL_PERMISSIONS,
  admin: ALL_PERMISSIONS.filter((p) => p !== PERMISSIONS.BILLING_MANAGE),
  manager: ALL_PERMISSIONS.filter((p) => !WORKSPACE_ADMIN_PERMISSIONS.includes(p)),
  support_lead: ALL_PERMISSIONS.filter(
    (p) => !WORKSPACE_ADMIN_PERMISSIONS.includes(p) || SUPPORT_LEAD_EXTRA_PERMISSIONS.includes(p)
  ),
  contributor: [
    ${contributor}
  ],
}

/** Legacy \`principal.role\` -> system role preset (admin -> Owner, member ->
 *  Manager, everything else -> none). */
export function presetForLegacyRole(role: string): SystemRoleKey | null {
  if (role === 'admin') return SYSTEM_ROLES.OWNER
  if (role === 'member') return SYSTEM_ROLES.MANAGER
  return null
}

/**
 * Each permission's category, for the read-only Roles matrix UI. The
 * (key, category) pairs mirror @quackback/db's PERMISSION_CATALOGUE; the drift
 * test enforces the projection. Descriptions live only in the db catalogue.
 */
export const PERMISSION_CATALOGUE: ReadonlyArray<{
  key: PermissionKey
  category: PermissionCategory
}> = [
${PERMISSION_CATALOGUE.map((entry) => `  { key: ${ref(entry.key)}, category: '${entry.category}' },`).join("\n")}
]
`;
}
