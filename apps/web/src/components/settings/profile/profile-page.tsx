import { useTranslation } from "react-i18next";
import PageTitle from "@/components/page-title";
import useAuth from "@/components/providers/auth-provider/hooks/use-auth";
import { AutosaveNote } from "@/components/settings/autosave-note";
import { DeleteAccountSection } from "@/components/settings/profile/delete-account-section";
import { ProfileDetailsSection } from "@/components/settings/profile/profile-details-section";
import { useProfileDetailsAutosave } from "@/components/settings/profile/use-profile-details-autosave";
import { SettingsPage } from "@/components/settings/settings-page";
import useManagedProfileFields from "@/hooks/queries/user/use-managed-profile-fields";

export function ProfilePage() {
  const { t } = useTranslation();
  const { user, refetchUser } = useAuth();
  const form = useProfileDetailsAutosave({
    name: user?.name,
    telegramHandle: user?.telegramHandle,
    refetchUser,
  });
  const managedFields = useManagedProfileFields();

  return (
    <>
      <PageTitle title={t("settings:informationPage.pageTitle")} />
      <SettingsPage
        title={t("settings:informationPage.title")}
        description={t("settings:informationPage.subtitle")}
        actions={<AutosaveNote />}
      >
        <ProfileDetailsSection
          form={form}
          user={user ?? undefined}
          refetchUser={refetchUser}
          managedFields={managedFields}
        />
        <DeleteAccountSection email={user?.email} />
      </SettingsPage>
    </>
  );
}
