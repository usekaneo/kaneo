import { useTranslation } from "react-i18next";
import PageTitle from "@/components/page-title";
import useAuth from "@/components/providers/auth-provider/hooks/use-auth";
import { AutosaveNote } from "@/components/settings/autosave-note";
import { DeleteAccountSection } from "@/components/settings/profile/delete-account-section";
import { ProfileDetailsSection } from "@/components/settings/profile/profile-details-section";
import { useProfileNameAutosave } from "@/components/settings/profile/use-profile-name-autosave";
import { SettingsPage } from "@/components/settings/settings-page";

export function ProfilePage() {
  const { t } = useTranslation();
  const { user, refetchUser } = useAuth();
  const form = useProfileNameAutosave({ name: user?.name, refetchUser });

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
        />
        <DeleteAccountSection email={user?.email} />
      </SettingsPage>
    </>
  );
}
