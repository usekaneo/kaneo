import type { UseFormReturn } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { AvatarRow } from "@/components/settings/profile/avatar-row";
import { SettingsCard } from "@/components/settings/settings-card";
import { SettingsFormRow } from "@/components/settings/settings-form-row";
import { SettingsRow } from "@/components/settings/settings-row";
import { SettingsSection } from "@/components/settings/settings-section";
import { Form, FormField } from "@/components/ui/form";
import { Input } from "@/components/ui/input";

type ProfileDetailsSectionProps = {
  form: UseFormReturn<{ name: string }>;
  user: { name?: string; email?: string; image?: string | null } | undefined;
  refetchUser: () => Promise<unknown>;
};

export function ProfileDetailsSection({
  form,
  user,
  refetchUser,
}: ProfileDetailsSectionProps) {
  const { t } = useTranslation();

  return (
    <SettingsSection title={t("settings:informationPage.sectionTitle")}>
      <SettingsCard>
        <AvatarRow
          name={user?.name}
          image={user?.image}
          refetchUser={refetchUser}
        />
        <Form {...form}>
          <form onSubmit={(event) => event.preventDefault()}>
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <SettingsFormRow label={t("settings:informationPage.fullName")}>
                  <Input
                    size="sm"
                    className="sm:w-64"
                    autoComplete="name"
                    placeholder={t(
                      "settings:informationPage.fullNamePlaceholder",
                    )}
                    {...field}
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
