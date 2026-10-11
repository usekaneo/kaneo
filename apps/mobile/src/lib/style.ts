export const PRIORITIES = [
  { value: "no-priority", label: "No priority" },
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
] as const;

export function priorityLabel(value?: string | null): string {
  return PRIORITIES.find((p) => p.value === value)?.label ?? "No priority";
}

/** The web app's label palette (Tailwind v4 500/600 shades). */
export const LABEL_COLORS = [
  { value: "gray", label: "Stone", color: "#79716B" },
  { value: "dark-gray", label: "Slate", color: "#62748E" },
  { value: "purple", label: "Lavender", color: "#8E51FF" },
  { value: "teal", label: "Sage", color: "#009966" },
  { value: "green", label: "Forest", color: "#00A63E" },
  { value: "yellow", label: "Amber", color: "#E17100" },
  { value: "orange", label: "Terracotta", color: "#F54900" },
  { value: "pink", label: "Rose", color: "#EC003F" },
  { value: "red", label: "Crimson", color: "#E7000B" },
] as const;

export function labelColor(value?: string | null): string {
  const named = LABEL_COLORS.find((c) => c.value === value);
  if (named) return named.color;
  // Older and imported labels may store a hex color.
  if (value && /^#[0-9a-f]{3,8}$/i.test(value)) return value;
  return "#A1A1A1";
}

export const WORKSPACE_ROLES = ["admin", "member", "viewer"];

export const ROLE_HINTS: Record<string, string> = {
  owner: "Full control, including deleting the workspace",
  admin: "Can also manage members and settings",
  member: "Can create and edit tasks",
  viewer: "Can view projects and tasks",
};

export function roleLabel(role: string) {
  return role.charAt(0).toUpperCase() + role.slice(1);
}

export function canManageWorkspace(role?: string | null) {
  return role === "owner" || role === "admin";
}

export const STATUS_PLANNED = "planned";
export const STATUS_ARCHIVED = "archived";
