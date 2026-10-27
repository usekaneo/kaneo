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
      includeSubtasks: project?.includeSubtasks ?? true,
    },
  });

  // Subscribe to dirty fields so reset can preserve edits during a refresh.
  const dirtyFieldsRef = useRef(form.formState.dirtyFields);
  dirtyFieldsRef.current = form.formState.dirtyFields;
  const formProjectIdRef = useRef(project?.id);

  useEffect(() => {
    if (!project) return;

    const nextValues = {
      name: project.name || "",
      slug: project.slug || "",
      description: project.description || "",
      icon: project.icon || "Layout",
      includeSubtasks: project.includeSubtasks ?? true,
    };
    lastSavedRef.current = normalizeProjectValues(nextValues);

    const sameProject = formProjectIdRef.current === project.id;
    formProjectIdRef.current = project.id;
    form.reset(nextValues, {
      keepDirtyValues:
        sameProject && Object.keys(dirtyFieldsRef.current).length > 0,
      keepTouched: sameProject,
      keepIsValid: true,
    });
  }, [project, form]);

  const saveProject = useCallback(
    async (data: ProjectFormValues): Promise<boolean> => {
      if (!project?.id) return false;

      if (isSavingRef.current) {
        queuedSaveRef.current = data;
        return inFlightSaveRef.current ?? false;
      }

      const normalizedData = normalizeProjectValues(data);
      const baseline = lastSavedRef.current;
      const changes = getProjectFieldChanges(baseline, normalizedData);

      changes.includeSubtasks =
        form.getFieldState("includeSubtasks").isDirty &&
        changes.includeSubtasks;
      if (!hasProjectFieldChanges(changes)) return true;

      isSavingRef.current = true;
      const submittedDirtyFields = new Set(
        (Object.keys(normalizedData) as Array<keyof ProjectFormValues>).filter(
          (key) => form.getFieldState(key).isDirty,
        ),
      );

      const runSave = async (): Promise<boolean> => {
        let succeeded = false;

        try {
          const updatedProject = await updateProject({
            id: project.id,
            name: changes.name
              ? normalizedData.name
              : (baseline?.name ?? project.name),
            slug: changes.slug
              ? normalizedData.slug
              : (baseline?.slug ?? project.slug),
            description: changes.description
              ? normalizedData.description
              : (baseline?.description ?? project.description ?? ""),
            icon: changes.icon
              ? normalizedData.icon
              : (baseline?.icon ?? project.icon ?? "Layout"),
            isPublic: !!project.isPublic,
            ...(changes.includeSubtasks
              ? { includeSubtasks: normalizedData.includeSubtasks }
              : {}),
          });

          const currentValues = normalizeProjectValues(form.getValues());
          const pendingChanges = getProjectFieldChanges(
            normalizedData,
            currentValues,
          );
          const pendingFields = (
            Object.keys(pendingChanges) as Array<keyof ProjectFormValues>
          ).filter(
            (key) =>
              pendingChanges[key] &&
              (submittedDirtyFields.has(key) ||
                form.getFieldState(key).isDirty),
          );
          const savedValues = normalizeProjectValues({
            name: updatedProject.name,
            slug: updatedProject.slug,
            description: updatedProject.description ?? "",
            icon: updatedProject.icon ?? "Layout",
            includeSubtasks: updatedProject.includeSubtasks ?? true,
          });
          form.reset(savedValues);
          lastSavedRef.current = savedValues;
          for (const key of pendingFields) {
            form.setValue(key, currentValues[key], { shouldDirty: true });
          }

          await Promise.all([
            queryClient.invalidateQueries({ queryKey: ["tasks", project.id] }),
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
            queuedSaveRef.current = null;
            succeeded = (await form.trigger())
              ? await saveProjectRef.current(form.getValues())
              : false;
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
        void saveProjectRef.current(form.getValues());
      }
    }, 800);
  }, [form]);

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
    if (!isSavingRef.current && !hasProjectFieldChanges(changes)) return true;

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
