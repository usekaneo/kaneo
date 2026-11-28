import type { PluginProject, QueryState } from "@kaneo/plugin-sdk/web";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useGetTasks } from "@/hooks/queries/task/use-get-tasks";
import { getStatusDisplayLabel } from "@/lib/i18n/domain";
import { toPluginProject } from "./to-plugin-project";

export function usePluginProject(projectId: string): QueryState<PluginProject> {
  const { data, isLoading, error } = useGetTasks(projectId);
  const { i18n } = useTranslation();
  const language = i18n.language;
  const project = useMemo(
    () =>
      data && language
        ? toPluginProject(data, getStatusDisplayLabel)
        : undefined,
    [data, language],
  );
  return { data: project, isLoading, error };
}
