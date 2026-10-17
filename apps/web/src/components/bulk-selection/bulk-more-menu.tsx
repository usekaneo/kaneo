import { Archive, MoreHorizontal, Search, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  Menu,
  MenuItem,
  MenuPopup,
  MenuSeparator,
  MenuTrigger,
} from "@/components/ui/menu";
import { barButtonClass } from "./bar-button-class";

type BulkMoreMenuProps = {
  onSearch: () => void;
  onArchive?: () => void;
  onDelete?: () => void;
};

export function BulkMoreMenu({
  onSearch,
  onArchive,
  onDelete,
}: BulkMoreMenuProps) {
  const { t } = useTranslation();

  return (
    <Menu>
      <MenuTrigger
        render={
          <button
            type="button"
            aria-label={t("tasks:bulk.moreActions")}
            className={`${barButtonClass} w-7 justify-center px-0`}
          />
        }
      >
        <MoreHorizontal />
      </MenuTrigger>
      <MenuPopup side="top" align="end" sideOffset={8} className="min-w-52">
        <MenuItem onClick={onSearch}>
          <Search />
          {t("tasks:bulk.searchActions")}
        </MenuItem>
        {onArchive && (
          <>
            <MenuSeparator />
            <MenuItem onClick={onArchive}>
              <Archive />
              {t("tasks:bulk.archive")}
            </MenuItem>
          </>
        )}
        {onDelete && (
          <>
            <MenuSeparator />
            <MenuItem variant="destructive" onClick={onDelete}>
              <Trash2 />
              {t("tasks:bulk.delete")}
            </MenuItem>
          </>
        )}
      </MenuPopup>
    </Menu>
  );
}
