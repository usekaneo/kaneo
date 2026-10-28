import { Fragment, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  Command,
  CommandCollection,
  CommandDialog,
  CommandDialogPopup,
  CommandEmpty,
  CommandGroup,
  CommandGroupLabel,
  CommandInput,
  CommandItem,
  CommandList,
  CommandPanel,
  CommandSeparator,
} from "@/components/ui/command";

export type BulkCommandItem = {
  value: string;
  label: string;
  icon?: ReactNode;
  onRun: () => void;
};

export type BulkCommandGroup = {
  value: string;
  label: string;
  items: BulkCommandItem[];
};

type BulkActionCommandProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groups: BulkCommandGroup[];
};

export function BulkActionCommand({
  open,
  onOpenChange,
  groups,
}: BulkActionCommandProps) {
  const { t } = useTranslation();

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandDialogPopup instant>
        <Command items={groups}>
          <CommandInput placeholder={t("tasks:bulk.searchActions")} />
          <CommandPanel>
            <CommandEmpty>{t("tasks:bulk.noActionsFound")}</CommandEmpty>
            <CommandList>
              {(group: BulkCommandGroup, groupIndex: number) => (
                <Fragment key={group.value}>
                  <CommandGroup items={group.items}>
                    <CommandGroupLabel>{group.label}</CommandGroupLabel>
                    <CommandCollection>
                      {(item: BulkCommandItem) => (
                        <CommandItem
                          key={item.value}
                          value={item.value}
                          onClick={() => {
                            onOpenChange(false);
                            item.onRun();
                          }}
                          className="gap-1.5 px-3"
                        >
                          <span className="shrink-0">{item.icon}</span>
                          <span className="flex-1 text-sm">{item.label}</span>
                        </CommandItem>
                      )}
                    </CommandCollection>
                  </CommandGroup>
                  {groupIndex < groups.length - 1 && <CommandSeparator />}
                </Fragment>
              )}
            </CommandList>
          </CommandPanel>
        </Command>
      </CommandDialogPopup>
    </CommandDialog>
  );
}
