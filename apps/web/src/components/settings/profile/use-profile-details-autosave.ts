import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import useUpdateUserProfile, {
  type UpdateUserProfileRequest,
} from "@/hooks/mutations/use-update-user-profile";
import { toast } from "@/lib/toast";
import { normalizeTelegramHandleInput } from "./telegram-handle";

export type ProfileFormValues = {
  name: string;
  telegramHandle: string;
};

type UseProfileDetailsAutosaveOptions = {
  name: string | undefined;
  telegramHandle: string | null | undefined;
  refetchUser: () => Promise<unknown>;
};

export function useProfileDetailsAutosave({
  name,
  telegramHandle,
  refetchUser,
}: UseProfileDetailsAutosaveOptions) {
  const { t } = useTranslation();
  const { mutateAsync: updateProfile } = useUpdateUserProfile();
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isSavingRef = useRef(false);
  const queuedSaveRef = useRef<ProfileFormValues | null>(null);
  const lastSavedRef = useRef<ProfileFormValues | null>(null);
  const schema = useMemo(
    () =>
      z.object({
        name: z
          .string()
          .min(1, t("settings:informationPage.validation.nameRequired"))
          .min(2, t("settings:informationPage.validation.nameShort")),
        telegramHandle: z.string().refine((value) => {
          try {
            normalizeTelegramHandleInput(value);
            return true;
          } catch {
            return false;
          }
        }, t("settings:informationPage.validation.telegramInvalid")),
      }),
    [t],
  );

  const form = useForm<ProfileFormValues>({
    resolver: standardSchemaResolver(schema),
    mode: "onChange",
    defaultValues: { name: name || "", telegramHandle: telegramHandle ?? "" },
  });

  useEffect(() => {
    if (name === undefined) return;

    const saved = {
      name: name.trim(),
      telegramHandle: telegramHandle ?? "",
    };
    lastSavedRef.current = saved;

    if (!form.formState.isDirty) {
      form.reset(saved);
    }
  }, [name, telegramHandle, form]);

  const saveDetails = useCallback(
    async (data: ProfileFormValues) => {
      const nextName = data.name.trim();
      let nextHandle: string | null;
      try {
        nextHandle = normalizeTelegramHandleInput(data.telegramHandle);
      } catch {
        return;
      }

      const last = lastSavedRef.current;
      const payload: UpdateUserProfileRequest = {};
      if (last?.name !== nextName) payload.name = nextName;
      if ((last?.telegramHandle ?? "") !== (nextHandle ?? "")) {
        payload.telegramHandle = nextHandle;
      }
      if (Object.keys(payload).length === 0) return;

      if (isSavingRef.current) {
        queuedSaveRef.current = data;
        return;
      }

      isSavingRef.current = true;

      try {
        await updateProfile(payload);

        const saved = { name: nextName, telegramHandle: nextHandle ?? "" };
        form.reset(saved, { keepDirty: false });
        lastSavedRef.current = saved;
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
          await saveDetails(queuedData);
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
        saveDetails(form.getValues());
      }
    }, 1000);
  }, [form, saveDetails]);

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

export default useProfileDetailsAutosave;
