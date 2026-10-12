import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { createWorkspaceFormSchema } from "@/components/settings/workspace-general/create-workspace-form-schema";
import {
  type NormalizedWorkspaceValues,
  normalizeWorkspaceValues,
  type WorkspaceFormValues,
} from "@/components/settings/workspace-general/workspace-form-values";
import useUpdateWorkspace from "@/hooks/mutations/workspace/use-update-workspace";
import { toast } from "@/lib/toast";

type UseWorkspaceAutosaveOptions = {
  workspaceId: string | undefined;
  name: string | undefined;
  description: string;
  canEdit: boolean;
};

export function useWorkspaceAutosave({
  workspaceId,
  name,
  description,
  canEdit,
}: UseWorkspaceAutosaveOptions) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { mutateAsync: updateWorkspace } = useUpdateWorkspace();
  const schema = useMemo(() => createWorkspaceFormSchema(t), [t]);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isSavingRef = useRef(false);
  const queuedSaveRef = useRef<WorkspaceFormValues | null>(null);
  const lastSavedRef = useRef<NormalizedWorkspaceValues | null>(null);

  const form = useForm<WorkspaceFormValues>({
    resolver: standardSchemaResolver(schema),
    mode: "onChange",
    defaultValues: { name: name || "", description },
  });

  useEffect(() => {
    if (!workspaceId) return;

    const nextValues = { name: name || "", description };
    lastSavedRef.current = normalizeWorkspaceValues(nextValues);

    if (!form.formState.isDirty) {
      form.reset(nextValues);
    }
  }, [workspaceId, name, description, form]);

  const saveWorkspace = useCallback(
    async (data: WorkspaceFormValues) => {
      if (!workspaceId) return;

      const normalizedData = normalizeWorkspaceValues(data);
      const nameChanged = lastSavedRef.current?.name !== normalizedData.name;
      const descriptionChanged =
        lastSavedRef.current?.description !== normalizedData.description;

      if (!nameChanged && !descriptionChanged) return;

      if (isSavingRef.current) {
        queuedSaveRef.current = data;
        return;
      }

      isSavingRef.current = true;

      try {
        await updateWorkspace({
          workspaceId,
          ...(nameChanged ? { name: normalizedData.name } : {}),
          ...(descriptionChanged
            ? { description: normalizedData.description }
            : {}),
        });

        form.reset(normalizedData, { keepDirty: false });
        lastSavedRef.current = normalizedData;
        queuedSaveRef.current = null;

        await queryClient.invalidateQueries({
          queryKey: ["active-organization"],
        });
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : t("settings:workspaceGeneral.toastUpdateError"),
        );
      } finally {
        isSavingRef.current = false;

        if (queuedSaveRef.current) {
          const queuedData = queuedSaveRef.current;
          queuedSaveRef.current = null;
          await saveWorkspace(queuedData);
        }
      }
    },
    [workspaceId, updateWorkspace, queryClient, form, t],
  );

  const debouncedSave = useCallback(() => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    debounceTimeoutRef.current = setTimeout(async () => {
      if (!form.formState.isDirty) return;
      if (await form.trigger()) {
        saveWorkspace(form.getValues());
      }
    }, 1000);
  }, [form, saveWorkspace]);

  useEffect(() => {
    if (!canEdit) return;
    const subscription = form.watch(() => {
      debouncedSave();
    });

    return () => subscription.unsubscribe();
  }, [form, debouncedSave, canEdit]);

  useEffect(() => {
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, []);

  return form;
}
