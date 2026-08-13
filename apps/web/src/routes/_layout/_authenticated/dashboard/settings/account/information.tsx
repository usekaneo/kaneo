import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2, Pencil, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import PageTitle from "@/components/page-title";
import useAuth from "@/components/providers/auth-provider/hooks/use-auth";
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/menu";
import { Separator } from "@/components/ui/separator";
import useDeleteAccount, {
  SESSION_TOO_OLD,
} from "@/hooks/mutations/use-delete-account";
import useRemoveUserAvatar from "@/hooks/mutations/use-remove-user-avatar";
import useUpdateUserAvatar from "@/hooks/mutations/use-update-user-avatar";
import useUpdateUserProfile from "@/hooks/mutations/use-update-user-profile";
import { getInitials } from "@/lib/get-initials";
import { ACCEPTED_AVATAR_TYPES } from "@/lib/prepare-avatar-image";
import { toast } from "@/lib/toast";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/settings/account/information",
)({
  component: RouteComponent,
});

type ProfileFormValues = {
  name: string;
  email: string;
};

type NormalizedProfileValues = {
  name: string;
  email: string;
};

function normalizeProfileValues(
  data: ProfileFormValues,
): NormalizedProfileValues {
  return {
    name: data.name.trim(),
    email: data.email,
  };
}

function RouteComponent() {
  const { t } = useTranslation();
  const { user, refetchUser } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { mutateAsync: updateProfile } = useUpdateUserProfile();
  const { mutateAsync: updateAvatar, isPending: isUploadingAvatar } =
    useUpdateUserAvatar();
  const { mutateAsync: removeAvatar, isPending: isRemovingAvatar } =
    useRemoveUserAvatar();
  const { mutateAsync: deleteAccount, isPending: isDeletingAccount } =
    useDeleteAccount();
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const canConfirmDelete =
    Boolean(user?.email) &&
    deleteConfirmation.trim().toLowerCase() === user?.email.toLowerCase();
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isSavingRef = useRef(false);
  const queuedSaveRef = useRef<ProfileFormValues | null>(null);
  const lastSavedRef = useRef<NormalizedProfileValues | null>(null);
  const profileSchema = z.object({
    name: z
      .string()
      .min(1, t("settings:informationPage.validation.nameRequired"))
      .min(2, t("settings:informationPage.validation.nameShort")),
    email: z
      .string()
      .email(t("settings:informationPage.validation.invalidEmail")),
  });

  const profileForm = useForm<ProfileFormValues>({
    resolver: standardSchemaResolver(profileSchema),
    mode: "onChange",
    defaultValues: {
      name: user?.name || "",
      email: user?.email || "",
    },
  });

  useEffect(() => {
    if (!user) return;

    const nextValues = {
      name: user.name || "",
      email: user.email || "",
    };
    lastSavedRef.current = normalizeProfileValues(nextValues);

    if (!profileForm.formState.isDirty) {
      profileForm.reset(nextValues);
    }
  }, [user, profileForm]);

  const saveProfile = useCallback(
    async (data: ProfileFormValues) => {
      const normalizedData = normalizeProfileValues(data);

      if (lastSavedRef.current?.name === normalizedData.name) {
        return;
      }

      if (isSavingRef.current) {
        queuedSaveRef.current = data;
        return;
      }

      isSavingRef.current = true;

      try {
        await updateProfile({
          name: normalizedData.name,
        });

        profileForm.reset(normalizedData, { keepDirty: false });
        lastSavedRef.current = normalizedData;
        queuedSaveRef.current = null;

        await refetchUser();
        toast.success(t("settings:informationPage.updateSuccess"));
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
          await saveProfile(queuedData);
        }
      }
    },
    [t, updateProfile, refetchUser, profileForm],
  );

  const handleAvatarSelected = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = "";

      if (!file) return;

      try {
        await updateAvatar(file);
        await refetchUser();
        toast.success(t("settings:informationPage.avatar.updateSuccess"));
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : t("settings:informationPage.avatar.updateError"),
        );
      }
    },
    [updateAvatar, refetchUser, t],
  );

  const handleAvatarRemoved = useCallback(async () => {
    try {
      await removeAvatar();
      await refetchUser();
      toast.success(t("settings:informationPage.avatar.removeSuccess"));
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("settings:informationPage.avatar.removeError"),
      );
    }
  }, [removeAvatar, refetchUser, t]);

  const handleDeleteAccount = useCallback(async () => {
    try {
      await deleteAccount();
      setIsDeleteModalOpen(false);
      queryClient.clear();
      toast.success(t("settings:informationPage.deleteAccount.success"));
      navigate({ to: "/auth/sign-in" });
    } catch (error) {
      if (error instanceof Error && error.message === SESSION_TOO_OLD) {
        toast.error(t("settings:informationPage.deleteAccount.sessionTooOld"));
        return;
      }

      toast.error(
        error instanceof Error
          ? error.message
          : t("settings:informationPage.deleteAccount.error"),
      );
    }
  }, [deleteAccount, queryClient, navigate, t]);

  const debouncedSave = useCallback(
    (data: ProfileFormValues) => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }

      debounceTimeoutRef.current = setTimeout(() => {
        saveProfile(data);
      }, 1000);
    },
    [saveProfile],
  );

  useEffect(() => {
    const subscription = profileForm.watch(() => {
      if (profileForm.formState.isDirty && profileForm.formState.isValid) {
        debouncedSave(profileForm.getValues());
      }
    });

    return () => subscription.unsubscribe();
  }, [profileForm, debouncedSave]);

  useEffect(() => {
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, []);

  return (
    <>
      <PageTitle title={t("settings:informationPage.pageTitle")} />
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold">
            {t("settings:informationPage.title")}
          </h1>
          <p className="text-muted-foreground">
            {t("settings:informationPage.subtitle")}
          </p>
        </div>

        <div className="space-y-6">
          <div className="space-y-1">
            <h2 className="text-md font-medium">
              {t("settings:informationPage.sectionTitle")}
            </h2>
            <p className="text-xs text-muted-foreground">
              {t("settings:informationPage.sectionSubtitle")}
            </p>
          </div>

          <div className="space-y-4 border border-border rounded-md p-4 bg-sidebar">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
              <div className="space-y-0.5">
                <p className="text-sm font-medium">
                  {t("settings:informationPage.profilePicture")}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t("settings:informationPage.avatar.hint")}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept={ACCEPTED_AVATAR_TYPES}
                  className="hidden"
                  onChange={handleAvatarSelected}
                />
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <button
                        type="button"
                        aria-label={t("settings:informationPage.avatar.edit")}
                        disabled={isUploadingAvatar || isRemovingAvatar}
                        className="group relative rounded-full outline-none transition-transform duration-150 ease-out active:scale-97 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar"
                      />
                    }
                  >
                    <Avatar className="h-10 w-10">
                      <AvatarImage
                        src={user?.image ?? ""}
                        alt={user?.name || ""}
                      />
                      <AvatarFallback className="text-xs font-medium border border-border/30">
                        {getInitials(user?.name)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-full bg-black/55 text-white opacity-0 transition-opacity duration-150 ease-out group-hover:opacity-100 group-focus-visible:opacity-100 group-data-[popup-open]:opacity-100 group-disabled:opacity-100">
                      {isUploadingAvatar || isRemovingAvatar ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Pencil className="size-3.5" />
                      )}
                    </span>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" side="bottom">
                    <DropdownMenuItem
                      onClick={() => avatarInputRef.current?.click()}
                    >
                      <Pencil />
                      {t("settings:informationPage.avatar.change")}
                    </DropdownMenuItem>
                    {user?.image ? (
                      <DropdownMenuItem onClick={handleAvatarRemoved}>
                        <X />
                        {t("settings:informationPage.avatar.remove")}
                      </DropdownMenuItem>
                    ) : null}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            <Separator />

            <Form {...profileForm}>
              <form className="space-y-4">
                <FormField
                  control={profileForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-sm font-medium">
                            {t("settings:informationPage.fullName")}
                          </FormLabel>
                        </div>
                        <FormControl>
                          <Input
                            className="w-full sm:w-48"
                            placeholder={t(
                              "settings:informationPage.fullNamePlaceholder",
                            )}
                            {...field}
                          />
                        </FormControl>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Separator />

                <FormField
                  control={profileForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-sm font-medium">
                            {t("settings:informationPage.email")}
                          </FormLabel>
                        </div>
                        <FormControl>
                          <Input
                            className="w-full sm:w-48"
                            placeholder={t(
                              "settings:informationPage.emailPlaceholder",
                            )}
                            {...field}
                            disabled
                            value={user?.email || ""}
                          />
                        </FormControl>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </form>
            </Form>
          </div>
        </div>

        <div className="space-y-6">
          <div className="space-y-1">
            <h2 className="text-md font-medium">
              {t("settings:informationPage.deleteAccount.sectionTitle")}
            </h2>
            <p className="text-xs text-muted-foreground">
              {t("settings:informationPage.deleteAccount.sectionSubtitle")}
            </p>
          </div>

          <div className="space-y-4 border border-border rounded-md p-4 bg-sidebar">
            <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
              <div className="space-y-0.5">
                <p className="text-sm font-medium">
                  {t("settings:informationPage.deleteAccount.title")}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t("settings:informationPage.deleteAccount.description")}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive transition-colors shrink-0"
                type="button"
                onClick={() => setIsDeleteModalOpen(true)}
              >
                {t("settings:informationPage.deleteAccount.title")}
              </Button>
            </div>
          </div>
        </div>

        <AlertDialog
          open={isDeleteModalOpen}
          onOpenChange={(open) => {
            setIsDeleteModalOpen(open);
            if (!open) setDeleteConfirmation("");
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {t("settings:informationPage.deleteAccount.modalTitle")}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {t("settings:informationPage.deleteAccount.modalDescription", {
                  email: user?.email ?? "",
                })}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="space-y-2 px-6 pb-5">
              <Label htmlFor="delete-account-confirmation">
                {t("settings:informationPage.deleteAccount.confirmLabel", {
                  email: user?.email ?? "",
                })}
              </Label>
              <Input
                id="delete-account-confirmation"
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                disabled={isDeletingAccount}
                value={deleteConfirmation}
                onChange={(event) => setDeleteConfirmation(event.target.value)}
                placeholder={user?.email ?? ""}
              />
            </div>
            <AlertDialogFooter>
              <AlertDialogClose
                render={
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isDeletingAccount}
                  />
                }
              >
                {t("common:actions.cancel")}
              </AlertDialogClose>
              <Button
                variant="destructive"
                size="sm"
                type="button"
                disabled={isDeletingAccount || !canConfirmDelete}
                onClick={handleDeleteAccount}
              >
                {isDeletingAccount
                  ? t("common:actions.deleting")
                  : t("settings:informationPage.deleteAccount.confirm")}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </>
  );
}
