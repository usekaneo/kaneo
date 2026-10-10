import { Puzzle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Spinner } from "@/components/ui/spinner";
import { PluginFailedMessage } from "./plugin-failed-message";

type PluginPageStatusProps = {
  status: "loading" | "missing" | "failed";
};

export function PluginPageStatus({ status }: PluginPageStatusProps) {
  const { t } = useTranslation();

  return (
    <div className="flex h-full min-h-40 w-full items-center justify-center p-6">
      {status === "loading" ? (
        <Spinner className="size-5 text-muted-foreground" />
      ) : status === "failed" ? (
        <PluginFailedMessage className="text-sm" />
      ) : (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Puzzle className="size-4" />
          {t("common:plugins.unavailable")}
        </p>
      )}
    </div>
  );
}
