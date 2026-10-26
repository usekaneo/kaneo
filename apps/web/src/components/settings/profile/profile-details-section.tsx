import type { UseFormReturn } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { ManagedProfileNote } from "@/components/settings/managed-profile-note";
import { AvatarRow } from "@/components/settings/profile/avatar-row";
import { SettingsCard } from "@/components/settings/settings-card";
import { SettingsFormRow } from "@/components/settings/settings-form-row";
import { SettingsRow } from "@/components/settings/settings-row";
import { SettingsSection } from "@/components/settings/settings-section";
import { Form, FormField } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import type { ManagedProfileField } from "@/hooks/queries/user/use-managed-profile-fields";

type ProfileDetailsSectionProps = {
  form: UseFormReturn<{ name: string }>;
  user: { name?: string; email?: string; image?: string | null } | undefined;
  refetchUser: () => Promise<unknown>;
  managedFields: readonly ManagedProfileField[];
};

export function ProfileDetailsSection({
  form,
  user,
  refetchUser,
  managedFields,
}: ProfileDetailsSectionProps) {
  const { t } = useTranslation();
  const isNameManaged = managedFields.includes("name");

  return (
    <SettingsSection title={t("settings:informationPage.sectionTitle")}>
      <SettingsCard>
        <AvatarRow
          name={user?.name}
          image={user?.image}
          refetchUser={refetchUser}
          managedNote={
            managedFields.includes("image") ? <ManagedProfileNote /> : undefined
          }
        />
        <Form {...form}>
          <form onSubmit={(event) => event.preventDefault()}>
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <SettingsFormRow
                  label={t("settings:informationPage.fullName")}
                  description={
                    isNameManaged ? <ManagedProfileNote /> : undefined
                  }
                >
                  <Input
                    size="sm"
                    className="sm:w-64"
                    autoComplete="name"
                    placeholder={t(
                      "settings:informationPage.fullNamePlaceholder",
                    )}
                    {...field}
                    disabled={isNameManaged}
                  />
                </SettingsFormRow>
              )}
            />
          </form>
        </Form>
        <SettingsRow
          stack
          title={t("settings:informationPage.email")}
          description={t("settings:informationPage.emailHint")}
        >
          <span className="max-w-64 truncate text-sm text-muted-foreground">
            {user?.email}
          </span>
        </SettingsRow>
      </SettingsCard>
    </SettingsSection>
  );
}
