import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { OptionMenu } from "@/components/common/option-menu/option-menu";
import {
  assigneeMenuOptions,
  type AssignableMember,
} from "./assignee-menu-options";

type AssigneeOptionsMenuProps = {
  members: AssignableMember[];
  current: string[] | undefined;
  onSelect: (id: string) => void;
  status?: ReactNode;
  disabled?: boolean;
};

export function AssigneeOptionsMenu({
  members,
  current,
  onSelect,
  status,
  disabled,
}: AssigneeOptionsMenuProps) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const options = assigneeMenuOptions(
    members,
    current,
    t("tasks:popover.assignee.unassigned"),
  );
  const unassigned = { ...options[0]!, pinned: true };
  const people = options.slice(1);
  return (
    <OptionMenu
      multiple
      disabled={disabled}
      label={t("tasks:assignee.label")}
      placeholder={t("tasks:bulk.assigneePlaceholder")}
      options={query.trim() ? [...people, unassigned] : [unassigned, ...people]}
      onQueryChange={setQuery}
      onSelect={onSelect}
      status={status}
    />
  );
}
