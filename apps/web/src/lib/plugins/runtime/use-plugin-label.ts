import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { pluginNamespace } from "./plugin-translations";

export function usePluginLabel(): (pluginId: string, text: string) => string {
  const { t } = useTranslation();
  return useCallback(
    (pluginId: string, text: string) =>
      t(text, { ns: pluginNamespace(pluginId), defaultValue: text }),
    [t],
  );
}
