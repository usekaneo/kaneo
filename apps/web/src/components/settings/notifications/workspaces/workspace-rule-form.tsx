import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ConfirmDialog } from "@/components/settings/confirm-dialog";
import { Button } from "@/components/ui/button";
import {
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  useDeleteNotificationWorkspaceRule,
  useUpsertNotificationWorkspaceRule,
} from "@/hooks/mutations/notification-preferences/use-notification-preferences";
import type { ChannelAvailabilityMap } from "../notification-channels";
import { WorkspaceRuleActiveRow } from "./workspace-rule-active-row";
import { WorkspaceRuleChannels } from "./workspace-rule-channels";
import { WorkspaceRuleProjects } from "./workspace-rule-projects";
import {
  createWorkspaceRuleState,
  RULE_CHANNEL_KEYS,
  toWorkspaceRuleRequest,
  type WorkspaceRule,
  type WorkspaceRuleState,
} from "./workspace-rule-state";

type WorkspaceRuleFormProps = {
  workspace: { id: string; name: string };
  rule: WorkspaceRule | undefined;
  availability: ChannelAvailabilityMap;
  onClose: () => void;
};

export function WorkspaceRuleForm({
  workspace,
  rule,
  availability,
  onClose,
}: WorkspaceRuleFormProps) {
  const { t } = useTranslation();
  const [state, setState] = useState<WorkspaceRuleState>(() =>
    createWorkspaceRuleState(rule, availability),
  );
  const [confirmStopOpen, setConfirmStopOpen] = useState(false);
  const { mutateAsync: upsertRule, isPending: saving } =
    useUpsertNotificationWorkspaceRule();
  const { mutateAsync: deleteRule, isPending: removing } =
    useDeleteNotificationWorkspaceRule();
  const busy = saving || removing;

  const update = (patch: Partial<WorkspaceRuleState>) =>
    setState((current) => ({ ...current, ...patch }));

  const save = async () => {
    const saved = await upsertRule({
      workspaceId: workspace.id,
      json: toWorkspaceRuleRequest(state, availability),
    }).then(
      () => true,
      () => false,
    );
    if (saved) onClose();
  };

  const stopSending = async () => {
    const removed = await deleteRule(workspace.id).then(
      () => true,
      () => false,
    );
    if (!removed) return;
    setConfirmStopOpen(false);
    onClose();
  };

  return (
    <>
      <form
        className="contents"
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <DialogHeader>
          <DialogTitle>
            {t("settings:notificationsPage.ruleDialogTitle", {
              workspaceName: workspace.name,
            })}
          </DialogTitle>
          <DialogDescription>
            {t("settings:notificationsPage.ruleDialogDescription")}
          </DialogDescription>
        </DialogHeader>
        <DialogPanel className="space-y-5">
          <WorkspaceRuleActiveRow
            checked={state.isActive}
            disabled={busy}
            onCheckedChange={(isActive) => update({ isActive })}
          />
          <WorkspaceRuleChannels
            availability={availability}
            disabled={busy}
            onChange={(channel, checked) => {
              const patch: Partial<WorkspaceRuleState> = {};
              patch[RULE_CHANNEL_KEYS[channel]] = checked;
              update(patch);
            }}
            state={state}
          />
          <WorkspaceRuleProjects
            disabled={busy}
            onModeChange={(projectMode) => update({ projectMode })}
            onToggleProject={(projectId, checked) =>
              setState((current) => ({
                ...current,
                selectedProjectIds: checked
                  ? [...current.selectedProjectIds, projectId]
                  : current.selectedProjectIds.filter((id) => id !== projectId),
              }))
            }
            projectMode={state.projectMode}
            selectedProjectIds={state.selectedProjectIds}
            workspaceId={workspace.id}
          />
        </DialogPanel>
        <DialogFooter>
          {rule ? (
            <Button
              className="text-destructive-foreground hover:text-destructive-foreground sm:me-auto"
              disabled={busy}
              onClick={() => setConfirmStopOpen(true)}
              type="button"
              variant="ghost"
            >
              {t("settings:notificationsPage.stopSending")}
            </Button>
          ) : null}
          <DialogClose
            disabled={busy}
            render={<Button type="button" variant="outline" />}
          >
            {t("common:actions.cancel")}
          </DialogClose>
          <Button disabled={busy} type="submit">
            {t("settings:notificationsPage.save")}
          </Button>
        </DialogFooter>
      </form>
      <ConfirmDialog
        open={confirmStopOpen}
        onOpenChange={setConfirmStopOpen}
        title={t("settings:notificationsPage.stopSendingTitle", {
          workspaceName: workspace.name,
        })}
        description={t("settings:notificationsPage.stopSendingDescription")}
        confirmLabel={t("settings:notificationsPage.stopSending")}
        pendingLabel={t("settings:notificationsPage.stopping")}
        pending={removing}
        onConfirm={() => void stopSending()}
      />
    </>
  );
}
