import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Combobox,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxPopup,
  ComboboxStatus,
} from "@/components/ui/combobox";
import useAdminUsers, {
  ADMIN_USERS_SEARCH_MAX_LENGTH,
  type AdminUser,
} from "@/hooks/queries/admin/use-admin-users";
import { useDebouncedValue } from "@/hooks/use-debounced-value";

type Props = {
  id: string;
  value: AdminUser | null;
  onValueChange: (user: AdminUser | null) => void;
  memberIds: ReadonlySet<string>;
  disabled?: boolean;
};

function InstanceUserCombobox({
  id,
  value,
  onValueChange,
  memberIds,
  disabled,
}: Props) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const search = useDebouncedValue(query, 250);
  const { data, isFetching, isError } = useAdminUsers(search, 0);
  const users = data?.users ?? [];
  const items =
    value && !users.some((user) => user.id === value.id)
      ? [value, ...users]
      : users;

  return (
    <Combobox
      items={items}
      filter={null}
      value={value}
      disabled={disabled}
      onValueChange={(next) => onValueChange(next)}
      onInputValueChange={setQuery}
      itemToStringLabel={(user) => user.name || user.email}
      isItemEqualToValue={(item, selected) => item.id === selected.id}
    >
      <ComboboxInput
        id={id}
        maxLength={ADMIN_USERS_SEARCH_MAX_LENGTH}
        placeholder={t("settings:adminWorkspaces.addMember.userPlaceholder")}
      />
      <ComboboxPopup>
        <ComboboxStatus>
          {isFetching
            ? t("settings:adminWorkspaces.addMember.searching")
            : isError
              ? t("settings:adminWorkspaces.addMember.usersError")
              : null}
        </ComboboxStatus>
        <ComboboxEmpty>
          {isFetching || isError
            ? null
            : t("settings:adminWorkspaces.addMember.noUsers")}
        </ComboboxEmpty>
        <ComboboxList>
          {(user: AdminUser) => {
            const isMember = memberIds.has(user.id);
            return (
              <ComboboxItem key={user.id} value={user} disabled={isMember}>
                <span className="flex min-w-0 flex-col">
                  <span className="truncate">{user.name || user.email}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {isMember
                      ? t("settings:adminWorkspaces.addMember.alreadyMember")
                      : user.email}
                  </span>
                </span>
              </ComboboxItem>
            );
          }}
        </ComboboxList>
      </ComboboxPopup>
    </Combobox>
  );
}

export default InstanceUserCombobox;
