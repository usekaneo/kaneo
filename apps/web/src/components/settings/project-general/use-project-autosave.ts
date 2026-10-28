import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { createProjectFormSchema } from "@/components/settings/project-general/create-project-form-schema";
import {
  getProjectFieldChanges,
  hasProjectFieldChanges,
  type NormalizedProjectValues,
  normalizeProjectValues,
  type ProjectFormValues,
} from "@/components/settings/project-general/project-form-values";
import useUpdateProject from "@/hooks/mutations/project/use-update-project";
import { toast } from "@/lib/toast";
import type { ProjectWithTasks } from "@/types/project";

type UseProjectAutosaveOptions = {
  project: ProjectWithTasks | undefined;
  workspaceId: string | undefined;
  canEdit: boolean;
};

export function useProjectAutosave({
  project,
  workspaceId,
  canEdit,
}: UseProjectAutosaveOptions) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { mutateAsync: updateProject } = useUpdateProject();
  const schema = useMemo(() => createProjectFormSchema(t), [t]);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isSavingRef = useRef(false);
  const queuedSaveRef = useRef<ProjectFormValues | null>(null);
  const inFlightSaveRef = useRef<Promise<boolean> | null>(null);
  const lastSavedRef = useRef<NormalizedProjectValues | null>(null);

  const form = useForm<ProjectFormValues>({
    resolver: standardSchemaResolver(schema),
    mode: "onChange",
    defaultValues: {
      name: project?.name || "",
      slug: project?.slug || "",
      description: project?.description || "",
      icon: project?.icon || "Layout",
    },
  });

  useEffect(() => {
    if (!project) return;

    const nextValues = {
      name: project.name || "",
      slug: project.slug || "",
      description: project.description || "",
      icon: project.icon || "Layout",
    };
    lastSavedRef.current = normalizeProjectValues(nextValues);

    if (form.formState.isDirty) return;

    form.reset(nextValues, {
      keepDirty: false,
      keepTouched: false,
      keepIsValid: true,
    });
  }, [project, form]);

  const saveProject = useCallback(
    async (data: ProjectFormValues): Promise<boolean> => {
      if (!project?.id) return false;

      const normalizedData = normalizeProjectValues(data);
      const changes = getProjectFieldChanges(
        lastSavedRef.current,
        normalizedData,
      );

      if (!hasProjectFieldChanges(changes)) return true;

      if (isSavingRef.current) {
        queuedSaveRef.current = data;
        return inFlightSaveRef.current ?? false;
      }

      isSavingRef.current = true;

      const runSave = async (): Promise<boolean> => {
        let succeeded = false;

        try {
          await updateProject({
            id: project.id,
            name: changes.name ? normalizedData.name : project.name,
            slug: changes.slug ? normalizedData.slug : project.slug,
            description: changes.description
              ? normalizedData.description
              : (project.description ?? ""),
            icon: changes.icon
              ? normalizedData.icon
              : (project.icon ?? "Layout"),
            isPublic: !!project.isPublic,
          });

          form.reset(normalizedData, { keepDirty: false });
          lastSavedRef.current = normalizedData;
          queuedSaveRef.current = null;

          await Promise.all([
            queryClient.invalidateQueries({ queryKey: ["projects"] }),
            queryClient.invalidateQueries({
              queryKey: ["projects", workspaceId],
            }),
            queryClient.invalidateQueries({
              queryKey: ["projects", workspaceId, project.id],
            }),
          ]);
          succeeded = true;
        } catch (error) {
          toast.error(
            error instanceof Error
              ? error.message
              : t("settings:projectGeneral.toastUpdateError"),
          );
        } finally {
          isSavingRef.current = false;

          if (queuedSaveRef.current) {
            const queuedData = queuedSaveRef.current;
            queuedSaveRef.current = null;
            succeeded = await saveProject(queuedData);
          }
        }

        return succeeded;
      };

      const pendingSave = runSave();
      inFlightSaveRef.current = pendingSave;

      try {
        return await pendingSave;
      } finally {
        if (inFlightSaveRef.current === pendingSave) {
          inFlightSaveRef.current = null;
        }
      }
    },
    [
      project?.id,
      project?.isPublic,
      project?.name,
      project?.slug,
      project?.description,
      project?.icon,
      updateProject,
      queryClient,
      workspaceId,
      form,
      t,
    ],
  );

  const saveProjectRef = useRef(saveProject);
  const formRef = useRef(form);
  saveProjectRef.current = saveProject;
  formRef.current = form;

  const debouncedSave = useCallback(() => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    debounceTimeoutRef.current = setTimeout(async () => {
      const isValid = await form.trigger();
      if (isValid) {
        saveProject(form.getValues());
      }
    }, 800);
  }, [form, saveProject]);

  useEffect(() => {
    if (!canEdit) return;
    const subscription = form.watch(() => {
      debouncedSave();
    });

    return () => subscription.unsubscribe();
  }, [form, debouncedSave, canEdit]);

  const flushPendingSave = useCallback(async () => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
      debounceTimeoutRef.current = null;
    }

    const latest = formRef.current.getValues();
    const changes = getProjectFieldChanges(
      lastSavedRef.current,
      normalizeProjectValues(latest),
    );
    if (!hasProjectFieldChanges(changes)) return true;

    const isValid = await formRef.current.trigger();
    if (!isValid) return false;

    return saveProjectRef.current(latest);
  }, []);

  useEffect(() => {
    return () => {
      void flushPendingSave();
    };
  }, [flushPendingSave]);

  return { form, flushPendingSave };
}
