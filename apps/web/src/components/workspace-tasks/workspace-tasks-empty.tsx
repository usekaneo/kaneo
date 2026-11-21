import { SquareKanban } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

type WorkspaceTasksEmptyProps = {
  filtered: boolean;
};

export default function WorkspaceTasksEmpty({
  filtered,
}: WorkspaceTasksEmptyProps) {
  const { t } = useTranslation();
  return (
    <Empty className="min-h-[60vh] w-full">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <SquareKanban />
        </EmptyMedia>
        <EmptyTitle>
          {filtered
            ? t("workspace:tasks.emptyFiltered")
            : t("workspace:tasks.empty")}
        </EmptyTitle>
        {!filtered && (
          <EmptyDescription>
            {t("workspace:tasks.emptyDescription")}
          </EmptyDescription>
        )}
      </EmptyHeader>
    </Empty>
  );
}
