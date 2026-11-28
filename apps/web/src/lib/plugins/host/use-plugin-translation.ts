import type { TranslateFunction } from "@kaneo/plugin-sdk/web";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { pluginNamespace } from "../runtime/plugin-translations";
import { usePluginScope } from "./plugin-scope-context";

export function usePluginTranslation(): TranslateFunction {
  const { id } = usePluginScope();
  const { t } = useTranslation();
  return useCallback<TranslateFunction>(
    (key, options) => t(key, { ...options, ns: pluginNamespace(id) }),
    [id, t],
  );
}
