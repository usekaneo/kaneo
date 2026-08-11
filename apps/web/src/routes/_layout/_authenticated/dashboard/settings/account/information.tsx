import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import PageTitle from "@/components/page-title";
import useAuth from "@/components/providers/auth-provider/hooks/use-auth";
import {
  AlertDialog,
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
import { Separator } from "@/components/ui/separator";
import useDeleteAccount from "@/hooks/mutations/use-delete-account";
import useUpdateUserProfile from "@/hooks/mutations/use-update-user-profile";
import { getInitials } from "@/lib/get-initials";
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
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { mutateAsync: updateProfile } = useUpdateUserProfile();
  const { mutateAsync: deleteAccount, isPending: isDeletingAccount } =
    useDeleteAccount();
  const [deleteOpen, setDeleteOpen] = useState(false);
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

        await queryClient.invalidateQueries({ queryKey: ["session"] });
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
    [t, updateProfile, queryClient, profileForm],
  );

  const debouncedSave = useCallback(
    (data: ProfileFormValues) => {
      if (deleteOpen || isDeletingAccount) return;

      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }

      debounceTimeoutRef.current = setTimeout(() => {
        saveProfile(data);
      }, 1000);
    },
    [saveProfile, deleteOpen, isDeletingAccount],
  );

  useEffect(() => {
    const subscription = profileForm.watch(() => {
      if (
        profileForm.formState.isDirty &&
        profileForm.formState.isValid &&
        !deleteOpen &&
        !isDeletingAccount
      ) {
        debouncedSave(profileForm.getValues());
      }
    });

    return () => subscription.unsubscribe();
  }, [profileForm, debouncedSave, deleteOpen, isDeletingAccount]);

  useEffect(() => {
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, []);

  const handleDeleteAccount = async () => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
      debounceTimeoutRef.current = null;
    }
    queuedSaveRef.current = null;

    try {
      await deleteAccount();
      queryClient.clear();
      toast.success(
        t("settings:informationPage.deleteAccount.successToast", {
          defaultValue: "Your account has been deleted.",
        }),
      );
      setDeleteOpen(false);
      navigate({ to: "/auth/sign-in" });
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("settings:informationPage.deleteAccount.errorToast", {
              defaultValue: "Failed to delete account.",
            }),
      );
    }
  };

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
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <p className="text-sm font-medium">
                  {t("settings:informationPage.profilePicture")}
                </p>
              </div>
              <Avatar className="h-10 w-10">
                <AvatarImage src={user?.image ?? ""} alt={user?.name || ""} />
                <AvatarFallback className="text-xs font-medium border border-border/30">
                  {getInitials(user?.name)}
                </AvatarFallback>
              </Avatar>
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

        {/* Danger Zone */}
        <div className="space-y-6">
          <div className="space-y-1">
            <h2 className="text-md font-medium text-destructive">
              {t("settings:informationPage.deleteAccount.sectionTitle", {
                defaultValue: "Danger Zone",
              })}
            </h2>
            <p className="text-xs text-muted-foreground">
              {t("settings:informationPage.deleteAccount.sectionDescription", {
                defaultValue:
                  "Permanently delete your account and all associated personal data.",
              })}
            </p>
          </div>

          <div className="space-y-4 border border-destructive/30 rounded-md p-4 bg-sidebar">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
              <div className="space-y-0.5">
                <p className="text-sm font-medium">
                  {t("settings:informationPage.deleteAccount.button", {
                    defaultValue: "Delete Account",
                  })}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t(
                    "settings:informationPage.deleteAccount.confirmDescription",
                    {
                      defaultValue:
                        "This action cannot be undone. Your account and all personal data will be permanently removed.",
                    },
                  )}
                </p>
              </div>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setDeleteOpen(true)}
              >
                {t("settings:informationPage.deleteAccount.button", {
                  defaultValue: "Delete Account",
                })}
              </Button>
            </div>
          </div>
        </div>

        <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {t("settings:informationPage.deleteAccount.confirmTitle", {
                  defaultValue: "Delete your account?",
                })}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {t(
                  "settings:informationPage.deleteAccount.confirmDescription",
                  {
                    defaultValue:
                      "This action cannot be undone. Your account and all personal data will be permanently removed.",
                  },
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <Button
                variant="outline"
                onClick={() => setDeleteOpen(false)}
                disabled={isDeletingAccount}
              >
                {t("common:actions.cancel", { defaultValue: "Cancel" })}
              </Button>
              <Button
                variant="destructive"
                onClick={handleDeleteAccount}
                disabled={isDeletingAccount}
              >
                {isDeletingAccount
                  ? t("common:actions.deleting", {
                      defaultValue: "Deleting...",
                    })
                  : t("common:actions.delete", { defaultValue: "Delete" })}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </>
  );
}
