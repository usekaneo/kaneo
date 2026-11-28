import { CloudOffIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

type BoardLoadErrorProps = {
  isRetrying: boolean;
  onRetry: () => void;
};

export function BoardLoadError({ isRetrying, onRetry }: BoardLoadErrorProps) {
  const { t } = useTranslation();

  return (
    <Empty className="h-full">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <CloudOffIcon />
        </EmptyMedia>
        <EmptyTitle role="heading" aria-level={2}>
          {t("tasks:board.loadErrorTitle")}
        </EmptyTitle>
        <EmptyDescription>
          {t("tasks:board.loadErrorDescription")}
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button variant="outline" loading={isRetrying} onClick={onRetry}>
          {t("tasks:board.tryAgain")}
        </Button>
      </EmptyContent>
    </Empty>
  );
}
