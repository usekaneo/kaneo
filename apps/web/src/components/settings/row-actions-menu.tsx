import { EllipsisIcon, type LucideIcon } from "lucide-react";
import { Fragment } from "react";
import { Button } from "@/components/ui/button";
import {
  Menu,
  MenuItem,
  MenuPopup,
  MenuSeparator,
  MenuTrigger,
} from "@/components/ui/menu";

export type RowAction = {
  id: string;
  label: string;
  icon: LucideIcon;
  onSelect: () => void;
  destructive?: boolean;
  disabled?: boolean;
};

type RowActionsMenuProps = {
  label: string;
  actions: RowAction[];
};

export function RowActionsMenu({ label, actions }: RowActionsMenuProps) {
  return (
    <Menu>
      <MenuTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={label}
            className="text-muted-foreground"
          />
        }
      >
        <EllipsisIcon aria-hidden="true" />
      </MenuTrigger>
      <MenuPopup align="end">
        {actions.map((action, index) => {
          const Icon = action.icon;
          const startsDestructive =
            action.destructive && index > 0 && !actions[index - 1]?.destructive;

          return (
            <Fragment key={action.id}>
              {startsDestructive ? <MenuSeparator /> : null}
              <MenuItem
                closeOnClick
                disabled={action.disabled}
                variant={action.destructive ? "destructive" : undefined}
                onClick={action.onSelect}
              >
                <Icon aria-hidden="true" />
                {action.label}
              </MenuItem>
            </Fragment>
          );
        })}
      </MenuPopup>
    </Menu>
  );
}
