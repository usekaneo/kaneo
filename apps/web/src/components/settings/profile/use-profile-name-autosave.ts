import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import useUpdateUserProfile from "@/hooks/mutations/use-update-user-profile";
import { toast } from "@/lib/toast";

type ProfileFormValues = {
  name: string;
};

type UseProfileNameAutosaveOptions = {
  name: string | undefined;
  refetchUser: () => Promise<unknown>;
};

export function useProfileNameAutosave({
  name,
  refetchUser,
}: UseProfileNameAutosaveOptions) {
  const { t } = useTranslation();
  const { mutateAsync: updateProfile } = useUpdateUserProfile();
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isSavingRef = useRef(false);
  const queuedSaveRef = useRef<ProfileFormValues | null>(null);
  const lastSavedRef = useRef<string | null>(null);
  const schema = useMemo(
    () =>
      z.object({
        name: z
          .string()
          .min(1, t("settings:informationPage.validation.nameRequired"))
          .min(2, t("settings:informationPage.validation.nameShort")),
      }),
    [t],
  );

  const form = useForm<ProfileFormValues>({
    resolver: standardSchemaResolver(schema),
    mode: "onChange",
    defaultValues: { name: name || "" },
  });

  useEffect(() => {
    if (name === undefined) return;

    lastSavedRef.current = name.trim();

    if (!form.formState.isDirty) {
      form.reset({ name });
    }
  }, [name, form]);

  const saveName = useCallback(
    async (data: ProfileFormValues) => {
      const nextName = data.name.trim();

      if (lastSavedRef.current === nextName) return;

      if (isSavingRef.current) {
        queuedSaveRef.current = data;
        return;
      }

      isSavingRef.current = true;

      try {
        await updateProfile({ name: nextName });

        form.reset({ name: nextName }, { keepDirty: false });
        lastSavedRef.current = nextName;
        queuedSaveRef.current = null;

        await refetchUser();
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : t("settings:informationPage.updateError"),
        );
      } finally {
        isSavingRef.current = false;

        if (queuedSaveRef.current) {
          const queuedData = queuedSaveRef.current;
          queuedSaveRef.current = null;
          await saveName(queuedData);
        }
      }
    },
    [t, updateProfile, refetchUser, form],
  );

  const debouncedSave = useCallback(() => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    debounceTimeoutRef.current = setTimeout(async () => {
      if (!form.formState.isDirty) return;
      if (await form.trigger()) {
        saveName(form.getValues());
      }
    }, 1000);
  }, [form, saveName]);

  useEffect(() => {
    const subscription = form.watch(() => {
      debouncedSave();
    });

    return () => subscription.unsubscribe();
  }, [form, debouncedSave]);

  useEffect(() => {
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, []);

  return form;
}
