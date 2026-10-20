import { useState } from "react";
import { useTranslation } from "react-i18next";
import { SettingsRow } from "@/components/settings/settings-row";
import { StatusBadge } from "@/components/settings/status-badge";
import { Button } from "@/components/ui/button";
import type { ChannelAvailabilityMap } from "../notification-channels";
import { getWorkspaceRuleSummary } from "./get-workspace-rule-summary";
import { WorkspaceRuleDialog } from "./workspace-rule-dialog";
import type { WorkspaceRule } from "./workspace-rule-state";

type WorkspaceRuleRowProps = {
  workspace: { id: string; name: string };
  rule: WorkspaceRule | undefined;
  availability: ChannelAvailabilityMap;
};

export function WorkspaceRuleRow({
  workspace,
  rule,
  availability,
}: WorkspaceRuleRowProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const initial = Array.from(workspace.name.trim())[0]?.toUpperCase() ?? "";

  return (
    <>
      <SettingsRow
        icon={
          <span className="text-[13px] font-semibold text-foreground">
            {initial}
          </span>
        }
        title={workspace.name}
        badge={
          rule ? (
            <StatusBadge tone={rule.isActive ? "success" : "warning"}>
              {rule.isActive
                ? t("settings:notificationsPage.statusSending")
                : t("settings:notificationsPage.statusPaused")}
            </StatusBadge>
          ) : null
        }
        description={getWorkspaceRuleSummary(rule, availability, t)}
      >
        <Button
          aria-label={
            rule
              ? t("settings:notificationsPage.configureWorkspace", {
                  workspaceName: workspace.name,
                })
              : t("settings:notificationsPage.setUpWorkspace", {
                  workspaceName: workspace.name,
                })
          }
          className="w-24"
          onClick={() => setOpen(true)}
          size="sm"
          type="button"
          variant="outline"
        >
          {rule
            ? t("settings:notificationsPage.configure")
            : t("settings:notificationsPage.setUp")}
        </Button>
      </SettingsRow>
      <WorkspaceRuleDialog
        availability={availability}
        onOpenChange={setOpen}
        open={open}
        rule={rule}
        workspace={workspace}
      />
    </>
  );
}
