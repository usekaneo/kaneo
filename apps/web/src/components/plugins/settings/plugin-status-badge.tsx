import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import type { PluginLoadState } from "@/store/plugin-runtime";

type PluginStatusBadgeProps = {
  state: PluginLoadState;
};

export function PluginStatusBadge({ state }: PluginStatusBadgeProps) {
  const { t } = useTranslation();

  if (state.status === "failed") {
    return (
      <Badge variant="error">
        {t("settings:workspacePlugins.status.failed")}
      </Badge>
    );
  }

  if (state.status === "loaded") {
    return (
      <Badge variant="success">
        {t("settings:workspacePlugins.status.loaded")}
      </Badge>
    );
  }

  return (
    <Badge variant="secondary">
      {t("settings:workspacePlugins.status.loading")}
    </Badge>
  );
}
