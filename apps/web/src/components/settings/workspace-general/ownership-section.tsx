import { useTranslation } from "react-i18next";
import { SettingsCard } from "@/components/settings/settings-card";
import { SettingsSection } from "@/components/settings/settings-section";
import { CurrentOwnerRow } from "@/components/settings/workspace-general/current-owner-row";
import { getOwnershipCandidates } from "@/components/settings/workspace-general/get-ownership-candidates";
import { TransferOwnershipRow } from "@/components/settings/workspace-general/transfer-ownership-row";

type OwnershipMember = {
  id: string;
  role: string;
  userId: string;
  user: { name: string; email: string; image?: string | null };
};

type OwnershipSectionProps = {
  workspaceId: string | undefined;
  workspaceName: string;
  members: OwnershipMember[];
  currentUserId: string | undefined;
};

export function OwnershipSection({
  workspaceId,
  workspaceName,
  members,
  currentUserId,
}: OwnershipSectionProps) {
  const { t } = useTranslation();
  const { currentOwner, eligibleNewOwners } = getOwnershipCandidates(
    members,
    currentUserId,
  );

  return (
    <SettingsSection
      title={t("settings:workspaceGeneral.ownershipTitle")}
      description={t("settings:workspaceGeneral.ownershipSubtitle")}
    >
      <SettingsCard>
        {currentOwner ? (
          <CurrentOwnerRow
            name={currentOwner.user.name}
            email={currentOwner.user.email}
            image={currentOwner.user.image}
          />
        ) : null}
        <TransferOwnershipRow
          workspaceId={workspaceId}
          workspaceName={workspaceName}
          currentOwnerMemberId={currentOwner?.id}
          candidates={eligibleNewOwners}
        />
      </SettingsCard>
    </SettingsSection>
  );
}
