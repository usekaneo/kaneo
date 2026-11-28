import { useTranslation } from "react-i18next";

type WorkspaceTasksErrorProps = {
  onRetry: () => void;
};

export default function WorkspaceTasksError({
  onRetry,
}: WorkspaceTasksErrorProps) {
  const { t } = useTranslation();
  return (
    <p role="alert" className="p-4 text-destructive text-sm">
      {t("workspace:tasks.loadError")}{" "}
      <button type="button" className="underline" onClick={onRetry}>
        {t("workspace:tasks.retry")}
      </button>
    </p>
  );
}
