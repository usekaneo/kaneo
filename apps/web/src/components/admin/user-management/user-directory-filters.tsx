import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { UserFilterSelect } from "./user-filter-select";
import {
  getRoleFilterOptions,
  hasUserFilters,
  NO_USER_FILTERS,
  USER_FILTER_OPTIONS,
  type UserFilterValues,
} from "./user-filters";

type UserDirectoryFiltersProps = {
  values: UserFilterValues;
  roles: readonly { name: string }[];
  onChange: (values: UserFilterValues) => void;
};

export function UserDirectoryFilters({
  values,
  roles,
  onChange,
}: UserDirectoryFiltersProps) {
  const { t } = useTranslation();
  const set =
    <Key extends keyof UserFilterValues>(key: Key) =>
    (value: UserFilterValues[Key]) =>
      onChange({ ...values, [key]: value });

  return (
    <div
      role="group"
      aria-label={t("settings:adminUsers.filters.label")}
      className="flex flex-col gap-2 sm:flex-row sm:items-center"
    >
      <UserFilterSelect
        label={t("settings:adminUsers.filters.status")}
        value={values.status}
        options={USER_FILTER_OPTIONS.status}
        onValueChange={set("status")}
      />
      <UserFilterSelect
        label={t("settings:adminUsers.filters.role")}
        value={values.role}
        options={getRoleFilterOptions(roles)}
        onValueChange={set("role")}
      />
      <UserFilterSelect
        label={t("settings:adminUsers.filters.email")}
        value={values.emailVerified}
        options={USER_FILTER_OPTIONS.emailVerified}
        onValueChange={set("emailVerified")}
      />
      {hasUserFilters(values) ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-muted-foreground"
          onClick={() => onChange(NO_USER_FILTERS)}
        >
          {t("settings:adminUsers.filters.clear")}
        </Button>
      ) : null}
    </div>
  );
}
