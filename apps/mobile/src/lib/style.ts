import { i18n } from "@/lib/i18n";

export const PRIORITIES = [
  {
    value: "no-priority",
    get label() {
      return i18n.t("mobile:meta.priority.noPriority");
    },
  },
  {
    value: "low",
    get label() {
      return i18n.t("mobile:meta.priority.low");
    },
  },
  {
    value: "medium",
    get label() {
      return i18n.t("mobile:meta.priority.medium");
    },
  },
  {
    value: "high",
    get label() {
      return i18n.t("mobile:meta.priority.high");
    },
  },
  {
    value: "urgent",
    get label() {
      return i18n.t("mobile:meta.priority.urgent");
    },
  },
] as const;

export function priorityLabel(value?: string | null): string {
  return (PRIORITIES.find((p) => p.value === value) ?? PRIORITIES[0]).label;
}

/** The web app's label palette (Tailwind v4 500/600 shades). */
export const LABEL_COLORS = [
  {
    value: "gray",
    get label() {
      return i18n.t("mobile:meta.labelColor.stone");
    },
    color: "#79716B",
  },
  {
    value: "dark-gray",
    get label() {
      return i18n.t("mobile:meta.labelColor.slate");
    },
    color: "#62748E",
  },
  {
    value: "purple",
    get label() {
      return i18n.t("mobile:meta.labelColor.lavender");
    },
    color: "#8E51FF",
  },
  {
    value: "teal",
    get label() {
      return i18n.t("mobile:meta.labelColor.sage");
    },
    color: "#009966",
  },
  {
    value: "green",
    get label() {
      return i18n.t("mobile:meta.labelColor.forest");
    },
    color: "#00A63E",
  },
  {
    value: "yellow",
    get label() {
      return i18n.t("mobile:meta.labelColor.amber");
    },
    color: "#E17100",
  },
  {
    value: "orange",
    get label() {
      return i18n.t("mobile:meta.labelColor.terracotta");
    },
    color: "#F54900",
  },
  {
    value: "pink",
    get label() {
      return i18n.t("mobile:meta.labelColor.rose");
    },
    color: "#EC003F",
  },
  {
    value: "red",
    get label() {
      return i18n.t("mobile:meta.labelColor.crimson");
    },
    color: "#E7000B",
  },
  {
    value: "blue",
    get label() {
      return i18n.t("mobile:meta.labelColor.ocean");
    },
    color: "#155DFC",
  },
  {
    value: "bright-yellow",
    get label() {
      return i18n.t("mobile:meta.labelColor.sunflower");
    },
    color: "#FDC700",
  },
  {
    value: "pale-pink",
    get label() {
      return i18n.t("mobile:meta.labelColor.blush");
    },
    color: "#FDA5D5",
  },
  {
    value: "pale-purple",
    get label() {
      return i18n.t("mobile:meta.labelColor.lilac");
    },
    color: "#C4B4FF",
  },
  {
    value: "pale-green",
    get label() {
      return i18n.t("mobile:meta.labelColor.mint");
    },
    color: "#5EE9B5",
  },
  {
    value: "pale-blue",
    get label() {
      return i18n.t("mobile:meta.labelColor.powder");
    },
    color: "#74D4FF",
  },
  {
    value: "pale-orange",
    get label() {
      return i18n.t("mobile:meta.labelColor.peach");
    },
    color: "#FFB86A",
  },
  {
    value: "pale-gray",
    get label() {
      return i18n.t("mobile:meta.labelColor.mist");
    },
    color: "#D6D3D1",
  },
  {
    value: "black",
    get label() {
      return i18n.t("mobile:meta.labelColor.ink");
    },
    color: "#171717",
  },
] as const;

// Briefly offered, no longer in the picker; labels that use them keep their color.
const RETIRED_LABEL_COLORS: Record<string, string> = {
  sky: "#00A6F4",
  cyan: "#0092B8",
  indigo: "#615FFF",
  fuchsia: "#C800DE",
  lime: "#5EA500",
  brown: "#7B3306",
  navy: "#1C398E",
  coral: "#FF6467",
};

export function labelColor(value?: string | null): string {
  const named = LABEL_COLORS.find((c) => c.value === value);
  if (named) return named.color;
  const retired = value ? RETIRED_LABEL_COLORS[value] : undefined;
  if (retired) return retired;
  // Older and imported labels may store a hex color.
  if (value && /^#[0-9a-f]{3,8}$/i.test(value)) return value;
  return "#A1A1A1";
}

export const WORKSPACE_ROLES = ["admin", "member", "viewer"];

// Getters resolve the text on read; custom roles have no hint and stay undefined.
export const ROLE_HINTS: Record<string, string> = {
  get owner() {
    return i18n.t("mobile:meta.roleHint.owner");
  },
  get admin() {
    return i18n.t("mobile:meta.roleHint.admin");
  },
  get member() {
    return i18n.t("mobile:meta.roleHint.member");
  },
  get viewer() {
    return i18n.t("mobile:meta.roleHint.viewer");
  },
};

function singleRoleLabel(role: string): string {
  switch (role) {
    case "owner":
      return i18n.t("mobile:meta.role.owner");
    case "admin":
      return i18n.t("mobile:meta.role.admin");
    case "member":
      return i18n.t("mobile:meta.role.member");
    case "viewer":
      return i18n.t("mobile:meta.role.viewer");
    default:
      // Custom roles keep their own name.
      return role.charAt(0).toUpperCase() + role.slice(1);
  }
}

export function roleLabel(role: string) {
  return role
    .split(",")
    .map((r) => singleRoleLabel(r.trim()))
    .join(", ");
}

/** A member can hold several roles, stored comma-separated like `admin,viewer`. */
export function hasRole(role: string | null | undefined, name: string) {
  return !!role && role.split(",").includes(name);
}

export const STATUS_PLANNED = "planned";
export const STATUS_ARCHIVED = "archived";
