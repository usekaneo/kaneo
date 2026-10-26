import type { AdminUserFilters } from "@/fetchers/admin/types";

/** Select values for the directory filters; "" means any. */
export type UserFilterValues = {
  status: "" | NonNullable<AdminUserFilters["status"]>;
  role: "" | NonNullable<AdminUserFilters["role"]>;
  emailVerified: "" | NonNullable<AdminUserFilters["emailVerified"]>;
};

export const NO_USER_FILTERS: UserFilterValues = {
  status: "",
  role: "",
  emailVerified: "",
};

export const USER_FILTER_OPTIONS = {
  status: [
    { value: "", labelKey: "settings:adminUsers.filters.anyStatus" },
    { value: "active", labelKey: "settings:adminUsers.status.active" },
    {
      value: "deactivated",
      labelKey: "settings:adminUsers.status.deactivated",
    },
  ],
  role: [
    { value: "", labelKey: "settings:adminUsers.filters.anyRole" },
    { value: "admin", labelKey: "settings:adminUsers.roles.admin" },
    { value: "user", labelKey: "settings:adminUsers.roles.user" },
  ],
  emailVerified: [
    { value: "", labelKey: "settings:adminUsers.filters.anyEmail" },
    { value: "true", labelKey: "settings:adminUsers.filters.verified" },
    { value: "false", labelKey: "settings:adminUsers.filters.unverified" },
  ],
} as const;

export function toAdminUserFilters(values: UserFilterValues): AdminUserFilters {
  return Object.fromEntries(
    Object.entries(values).filter(([, value]) => value !== ""),
  ) as AdminUserFilters;
}

export function hasUserFilters(values: UserFilterValues) {
  return Object.values(values).some((value) => value !== "");
}
