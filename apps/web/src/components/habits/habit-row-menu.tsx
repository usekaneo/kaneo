import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Menu, MenuItem, MenuPopup, MenuTrigger } from "@/components/ui/menu";

type HabitRowMenuProps = {
  name: string;
  onRename: () => void;
  onDelete: () => void;
};

export function HabitRowMenu({ name, onRename, onDelete }: HabitRowMenuProps) {
  const { t } = useTranslation();
  const [confirming, setConfirming] = useState(false);
  const label = t("navigation:habits.options", { habit: name });

  return (
    <>
      <Menu>
        <MenuTrigger
          aria-label={label}
          title={label}
          className="flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground outline-none transition-opacity hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring md:opacity-0 group-focus-within/habit:opacity-100 group-hover/habit:opacity-100 data-popup-open:opacity-100"
        >
          <MoreHorizontal className="size-4" aria-hidden="true" />
        </MenuTrigger>
        <MenuPopup align="start">
          <MenuItem onClick={onRename}>
            <Pencil />
            <span>{t("navigation:habits.rename")}</span>
          </MenuItem>
          <MenuItem variant="destructive" onClick={() => setConfirming(true)}>
            <Trash2 />
            <span>{t("navigation:habits.delete")}</span>
          </MenuItem>
        </MenuPopup>
      </Menu>
      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("navigation:habits.deleteTitle", { habit: name })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("navigation:habits.deleteDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogClose render={<Button variant="outline" size="sm" />}>
              {t("navigation:habits.cancel")}
            </AlertDialogClose>
            <AlertDialogClose
              render={
                <Button variant="destructive" size="sm" onClick={onDelete} />
              }
            >
              {t("navigation:habits.delete")}
            </AlertDialogClose>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
