import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogDescription,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "@/components/ui/dialog";
import type { GlobalBoardProject } from "@/fetchers/task/get-global-board-meta";
import { getColumnIcon } from "@/lib/column";

type ProjectColumn = GlobalBoardProject["columns"][number];

export type ColumnChoice = {
  taskTitle: string;
  projectName: string;
  laneName: string;
  columns: ProjectColumn[];
  onChoose: (column: ProjectColumn) => void;
};

// Shown when a lane maps to several columns of the task's project, so the
// move never lands in a column the user did not pick.
export function ColumnChoiceDialog({
  choice,
  onClose,
}: {
  choice: ColumnChoice | null;
  onClose: () => void;
}) {
  const { t } = useTranslation();

  return (
    <Dialog open={choice !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogPopup className="sm:max-w-sm">
        {choice && (
          <>
            <DialogHeader>
              <DialogTitle>
                {t("tasks:globalBoard.chooseColumnTitle")}
              </DialogTitle>
              <DialogDescription>
                {t("tasks:globalBoard.chooseColumnDescription", {
                  title: choice.taskTitle,
                  project: choice.projectName,
                  lane: choice.laneName,
                })}
              </DialogDescription>
            </DialogHeader>
            <DialogPanel className="flex flex-col gap-1.5">
              {choice.columns.map((column) => (
                <Button
                  key={`${column.slug}-${column.position}`}
                  variant="outline"
                  className="justify-start"
                  onClick={() => {
                    choice.onChoose(column);
                    onClose();
                  }}
                >
                  {getColumnIcon(column.slug, column.isFinal, column.icon)}
                  {column.name}
                </Button>
              ))}
            </DialogPanel>
          </>
        )}
      </DialogPopup>
    </Dialog>
  );
}
