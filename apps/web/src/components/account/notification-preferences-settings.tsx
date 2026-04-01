import { CheckCircle, Trash2 } from "lucide-react";
import React from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Radio, RadioGroup } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
  useDeleteNotificationWorkspaceRule,
  useUpdateNotificationPreferences,
  useUpsertNotificationWorkspaceRule,
} from "@/hooks/mutations/notification-preferences/use-notification-preferences";
import useGetNotificationPreferences from "@/hooks/queries/notification-preferences/use-get-notification-preferences";
import useGetProjects from "@/hooks/queries/project/use-get-projects";
import useGetWorkspaces from "@/hooks/queries/workspace/use-get-workspaces";
import { toast } from "@/lib/toast";

type WorkspaceSummary = {
  id: string;
  name: string;
};

type WorkspaceRuleState = {
  isActive: boolean;
  emailEnabled: boolean;
  ntfyEnabled: boolean;
  gotifyEnabled: boolean;
  webhookEnabled: boolean;
  projectMode: "all" | "selected";
  selectedProjectIds: string[];
};

function ChannelToggle({
  checked,
  disabled,
  hint,
  label,
  onCheckedChange,
}: {
  checked: boolean;
  disabled?: boolean;
  hint?: string;
  label: string;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0 space-y-0.5">
        <Label className="text-sm font-medium">{label}</Label>
        {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      </div>
      <Switch
        checked={checked}
        disabled={disabled}
        onCheckedChange={onCheckedChange}
      />
    </div>
  );
}

function WorkspaceRuleCard({
  hasEmailChannel,
  hasGotifyChannel,
  hasNtfyChannel,
  hasWebhookChannel,
  onDelete,
  onSave,
  rule,
  workspace,
}: {
  hasEmailChannel: boolean;
  hasGotifyChannel: boolean;
  hasNtfyChannel: boolean;
  hasWebhookChannel: boolean;
  onDelete: (workspaceId: string) => Promise<unknown>;
  onSave: (workspaceId: string, rule: WorkspaceRuleState) => Promise<void>;
  rule?: {
    isActive: boolean;
    emailEnabled: boolean;
    ntfyEnabled: boolean;
    gotifyEnabled: boolean;
    webhookEnabled: boolean;
    projectMode: "all" | "selected";
    selectedProjectIds: string[];
  };
  workspace: WorkspaceSummary;
}) {
  const { t } = useTranslation();
  const [state, setState] = React.useState<WorkspaceRuleState>({
    isActive: rule?.isActive ?? false,
    emailEnabled: rule?.emailEnabled ?? false,
    ntfyEnabled: rule?.ntfyEnabled ?? false,
    gotifyEnabled: rule?.gotifyEnabled ?? false,
    webhookEnabled: rule?.webhookEnabled ?? false,
    projectMode: rule?.projectMode ?? "all",
    selectedProjectIds: rule?.selectedProjectIds ?? [],
  });
  const [isSaving, setIsSaving] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const { data: projects } = useGetProjects({
    workspaceId:
      state.projectMode === "selected" ||
      (rule?.projectMode ?? "all") === "selected"
        ? workspace.id
        : "",
  });

  React.useEffect(() => {
    setState({
      isActive: rule?.isActive ?? false,
      emailEnabled: rule?.emailEnabled ?? false,
      ntfyEnabled: rule?.ntfyEnabled ?? false,
      gotifyEnabled: rule?.gotifyEnabled ?? false,
      webhookEnabled: rule?.webhookEnabled ?? false,
      projectMode: rule?.projectMode ?? "all",
      selectedProjectIds: rule?.selectedProjectIds ?? [],
    });
  }, [rule]);

  const isConnected = Boolean(rule);
  const isBusy = isSaving || isDeleting;

  const toggleProject = (projectId: string, checked: boolean) => {
    setState((current) => ({
      ...current,
      selectedProjectIds: checked
        ? [...current.selectedProjectIds, projectId]
        : current.selectedProjectIds.filter((id) => id !== projectId),
    }));
  };

  return (
    <div className="space-y-4 border border-border rounded-md bg-sidebar p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-medium">{workspace.name}</p>
          <p className="text-xs text-muted-foreground">
            {t("settings:notificationsPage.workspaceCardHint")}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          {isConnected ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <CheckCircle className="size-4 text-green-600" />
              <span>
                {state.isActive
                  ? t("settings:notificationsPage.statusConnected")
                  : t("settings:notificationsPage.statusPaused")}
              </span>
            </div>
          ) : null}
          <Switch
            checked={state.isActive}
            disabled={isBusy}
            onCheckedChange={(checked) =>
              setState((current) => ({ ...current, isActive: checked }))
            }
          />
        </div>
      </div>

      <Separator />

      <div className="space-y-3">
        <ChannelToggle
          checked={state.emailEnabled}
          disabled={!hasEmailChannel || isBusy}
          hint={
            hasEmailChannel
              ? t("settings:notificationsPage.emailChannelHintEnabled")
              : t("settings:notificationsPage.emailChannelHintDisabled")
          }
          label={t("settings:notificationsPage.workspaceCardLabelEmail")}
          onCheckedChange={(checked) =>
            setState((current) => ({ ...current, emailEnabled: checked }))
          }
        />
        <ChannelToggle
          checked={state.ntfyEnabled}
          disabled={!hasNtfyChannel || isBusy}
          hint={
            hasNtfyChannel
              ? t("settings:notificationsPage.ntfyChannelHintEnabled")
              : t("settings:notificationsPage.ntfyChannelHintDisabled")
          }
          label={t("settings:notificationsPage.workspaceCardLabelNtfy")}
          onCheckedChange={(checked) =>
            setState((current) => ({ ...current, ntfyEnabled: checked }))
          }
        />
        <ChannelToggle
          checked={state.gotifyEnabled}
          disabled={!hasGotifyChannel || isBusy}
          hint={
            hasGotifyChannel
              ? t("settings:notificationsPage.gotifyChannelHintEnabled")
              : t("settings:notificationsPage.gotifyChannelHintDisabled")
          }
          label={t("settings:notificationsPage.workspaceCardLabelGotify")}
          onCheckedChange={(checked) =>
            setState((current) => ({ ...current, gotifyEnabled: checked }))
          }
        />
        <ChannelToggle
          checked={state.webhookEnabled}
          disabled={!hasWebhookChannel || isBusy}
          hint={
            hasWebhookChannel
              ? t("settings:notificationsPage.webhookChannelHintEnabled")
              : t("settings:notificationsPage.webhookChannelHintDisabled")
          }
          label={t("settings:notificationsPage.workspaceCardLabelWebhook")}
          onCheckedChange={(checked) =>
            setState((current) => ({ ...current, webhookEnabled: checked }))
          }
        />
      </div>

      <Separator />

      <div className="space-y-3">
        <div className="space-y-0.5">
          <Label className="text-sm font-medium">
            {t("settings:notificationsPage.projectScope")}
          </Label>
          <p className="text-xs text-muted-foreground">
            {t("settings:notificationsPage.projectScopeDescription")}
          </p>
        </div>

        <RadioGroup
          className="gap-2"
          value={state.projectMode}
          onValueChange={(value) =>
            setState((current) => ({
              ...current,
              projectMode: value === "selected" ? "selected" : "all",
            }))
          }
        >
          <label
            className="flex items-start gap-3"
            htmlFor={`${workspace.id}-project-scope-all`}
          >
            <Radio
              className="mt-0.5"
              id={`${workspace.id}-project-scope-all`}
              value="all"
            />
            <div className="min-w-0 space-y-0.5">
              <p className="text-sm font-medium">
                {t("settings:notificationsPage.allProjects")}
              </p>
              <p className="text-xs text-muted-foreground">
                {t("settings:notificationsPage.allProjectsDescription")}
              </p>
            </div>
          </label>

          <label
            className="flex items-start gap-3"
            htmlFor={`${workspace.id}-project-scope-selected`}
          >
            <Radio
              className="mt-0.5"
              id={`${workspace.id}-project-scope-selected`}
              value="selected"
            />
            <div className="min-w-0 space-y-0.5">
              <p className="text-sm font-medium">
                {t("settings:notificationsPage.selectedProjects")}
              </p>
              <p className="text-xs text-muted-foreground">
                {t("settings:notificationsPage.selectedProjectsDescription")}
              </p>
            </div>
          </label>
        </RadioGroup>

        {state.projectMode === "selected" ? (
          <div className="space-y-2 border border-dashed border-border/80 rounded-md px-3 py-3">
            {!projects?.length ? (
              <p className="text-sm text-muted-foreground">
                {t("settings:notificationsPage.noProjectsInWorkspace")}
              </p>
            ) : (
              projects.map((project) => {
                const checked = state.selectedProjectIds.includes(project.id);

                return (
                  <label
                    key={project.id}
                    className="flex items-center gap-3"
                    htmlFor={`${workspace.id}-project-${project.id}`}
                  >
                    <Checkbox
                      checked={checked}
                      id={`${workspace.id}-project-${project.id}`}
                      onCheckedChange={(value) =>
                        toggleProject(project.id, Boolean(value))
                      }
                    />
                    <span className="text-sm font-medium">{project.name}</span>
                  </label>
                );
              })
            )}
          </div>
        ) : null}
      </div>

      <Separator />

      <div className="flex flex-wrap gap-2">
        <Button
          disabled={isBusy}
          onClick={async () => {
            try {
              setIsSaving(true);
              await onSave(workspace.id, state);
              toast.success(
                t("settings:notificationsPage.toastRuleSaved", {
                  workspaceName: workspace.name,
                }),
              );
            } catch (error) {
              toast.error(
                error instanceof Error
                  ? error.message
                  : t("settings:notificationsPage.toastRuleSaveFailed"),
              );
            } finally {
              setIsSaving(false);
            }
          }}
          type="button"
        >
          {isConnected
            ? t("settings:notificationsPage.saveChanges")
            : t("settings:notificationsPage.createRule")}
        </Button>
        {isConnected ? (
          <Button
            disabled={isBusy}
            onClick={async () => {
              try {
                setIsDeleting(true);
                await onDelete(workspace.id);
                toast.success(
                  t("settings:notificationsPage.toastRuleRemoved", {
                    workspaceName: workspace.name,
                  }),
                );
              } catch (error) {
                toast.error(
                  error instanceof Error
                    ? error.message
                    : t("settings:notificationsPage.toastRuleRemoveFailed"),
                );
              } finally {
                setIsDeleting(false);
              }
            }}
            type="button"
            variant="outline"
          >
            <Trash2 className="size-4" />
            {t("settings:notificationsPage.removeRule")}
          </Button>
        ) : null}
      </div>
    </div>
  );
}

export function NotificationPreferencesSettings() {
  const { t } = useTranslation();
  const { data: preferences, isLoading } = useGetNotificationPreferences();
  const { data: workspacesData } = useGetWorkspaces();
  const { mutateAsync: updatePreferences, isPending: isSavingPreferences } =
    useUpdateNotificationPreferences();
  const { mutateAsync: upsertWorkspaceRule } =
    useUpsertNotificationWorkspaceRule();
  const { mutateAsync: deleteWorkspaceRule } =
    useDeleteNotificationWorkspaceRule();

  const workspaces = React.useMemo(
    () =>
      ((workspacesData ?? []) as WorkspaceSummary[]).map((workspace) => ({
        id: workspace.id,
        name: workspace.name,
      })),
    [workspacesData],
  );

  const [emailEnabled, setEmailEnabled] = React.useState(false);
  const [ntfyEnabled, setNtfyEnabled] = React.useState(false);
  const [ntfyServerUrl, setNtfyServerUrl] = React.useState("");
  const [ntfyTopic, setNtfyTopic] = React.useState("");
  const [ntfyToken, setNtfyToken] = React.useState("");
  const [gotifyEnabled, setGotifyEnabled] = React.useState(false);
  const [gotifyServerUrl, setGotifyServerUrl] = React.useState("");
  const [gotifyToken, setGotifyToken] = React.useState("");
  const [webhookEnabled, setWebhookEnabled] = React.useState(false);
  const [webhookUrl, setWebhookUrl] = React.useState("");
  const [webhookSecret, setWebhookSecret] = React.useState("");

  React.useEffect(() => {
    if (!preferences) return;
    setEmailEnabled(preferences.emailEnabled);
    setNtfyEnabled(preferences.ntfyEnabled);
    setNtfyServerUrl(preferences.ntfyServerUrl ?? "");
    setNtfyTopic(preferences.ntfyTopic ?? "");
    setNtfyToken("");
    setGotifyEnabled(preferences.gotifyEnabled);
    setGotifyServerUrl(preferences.gotifyServerUrl ?? "");
    setGotifyToken("");
    setWebhookEnabled(preferences.webhookEnabled);
    setWebhookUrl(preferences.webhookUrl ?? "");
    setWebhookSecret("");
  }, [preferences]);

  const workspaceRuleMap = React.useMemo(
    () =>
      new Map(
        (preferences?.workspaces ?? []).map((workspaceRule) => [
          workspaceRule.workspaceId,
          workspaceRule,
        ]),
      ),
    [preferences?.workspaces],
  );

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-24 animate-pulse rounded-md bg-muted" />
        <div className="h-24 animate-pulse rounded-md bg-muted" />
        <div className="h-48 animate-pulse rounded-md bg-muted" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="space-y-4 rounded-md border border-border bg-sidebar p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <h3 className="font-medium">
              {t("settings:notificationsPage.emailTitle")}
            </h3>
            <p className="text-sm text-muted-foreground">
              {t("settings:notificationsPage.emailDescription")}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {preferences?.emailEnabled ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <CheckCircle className="size-4 text-green-600" />
                <span>{t("settings:notificationsPage.statusConnected")}</span>
              </div>
            ) : null}
            <Switch
              checked={emailEnabled}
              disabled={isSavingPreferences || !preferences?.emailAddress}
              onCheckedChange={setEmailEnabled}
            />
          </div>
        </div>

        <div className="space-y-1">
          <Label className="text-sm font-medium">
            {t("settings:notificationsPage.accountEmailLabel")}
          </Label>
          <Input
            disabled
            readOnly
            value={
              preferences?.emailAddress ??
              t("settings:notificationsPage.accountEmailNoAddress")
            }
          />
          <p className="text-xs text-muted-foreground">
            {t("settings:notificationsPage.accountEmailHint")}
          </p>
        </div>

        <div className="flex gap-2">
          <Button
            disabled={isSavingPreferences || !preferences?.emailAddress}
            onClick={async () => {
              try {
                await updatePreferences({ emailEnabled });
                toast.success(t("settings:notificationsPage.toastEmailSaved"));
              } catch (error) {
                toast.error(
                  error instanceof Error
                    ? error.message
                    : t("settings:notificationsPage.toastEmailSaveFailed"),
                );
              }
            }}
            type="button"
          >
            {t("settings:notificationsPage.saveChanges")}
          </Button>
        </div>
      </div>

      <div className="space-y-4 rounded-md border border-border bg-sidebar p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <h3 className="font-medium">
              {t("settings:notificationsPage.gotifyTitle")}
            </h3>
            <p className="text-sm text-muted-foreground">
              {t("settings:notificationsPage.gotifyDescription")}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {preferences?.gotifyConfigured ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <CheckCircle className="size-4 text-green-600" />
                <span>
                  {preferences.gotifyEnabled
                    ? t("settings:notificationsPage.statusConnected")
                    : t("settings:notificationsPage.statusPaused")}
                </span>
              </div>
            ) : null}
            <Switch
              checked={gotifyEnabled}
              disabled={isSavingPreferences}
              onCheckedChange={setGotifyEnabled}
            />
          </div>
        </div>

        <div className="space-y-4">
          <div className="space-y-1">
            <Label className="text-sm font-medium">
              {t("settings:notificationsPage.serverUrl")}
            </Label>
            <Input
              autoComplete="off"
              placeholder={t(
                "settings:notificationsPage.gotifyServerPlaceholder",
              )}
              value={gotifyServerUrl}
              onChange={(event) => setGotifyServerUrl(event.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-sm font-medium">
              {t("settings:notificationsPage.gotifyTokenLabel")}
            </Label>
            <Input
              autoComplete="off"
              placeholder={t(
                "settings:notificationsPage.gotifyTokenPlaceholder",
              )}
              type="password"
              value={gotifyToken}
              onChange={(event) => setGotifyToken(event.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              {preferences?.gotifyTokenConfigured
                ? t("settings:notificationsPage.gotifyTokenHintConfigured", {
                    masked: preferences.maskedGotifyToken ?? "••••",
                  })
                : t("settings:notificationsPage.gotifyTokenHintRequired")}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            disabled={isSavingPreferences}
            onClick={async () => {
              try {
                await updatePreferences({
                  gotifyEnabled,
                  gotifyServerUrl,
                  gotifyToken: gotifyToken.trim() ? gotifyToken : undefined,
                });
                setGotifyToken("");
                toast.success(t("settings:notificationsPage.toastGotifySaved"));
              } catch (error) {
                toast.error(
                  error instanceof Error
                    ? error.message
                    : t("settings:notificationsPage.toastGotifySaveFailed"),
                );
              }
            }}
            type="button"
          >
            {preferences?.gotifyConfigured
              ? t("settings:notificationsPage.saveChanges")
              : t("settings:notificationsPage.connectGotify")}
          </Button>
          {preferences?.gotifyConfigured ? (
            <Button
              disabled={isSavingPreferences}
              onClick={async () => {
                try {
                  await updatePreferences({
                    gotifyEnabled: false,
                    gotifyServerUrl: null,
                    gotifyToken: null,
                  });
                  setGotifyEnabled(false);
                  setGotifyServerUrl("");
                  setGotifyToken("");
                  toast.success(
                    t("settings:notificationsPage.toastGotifyDisconnected"),
                  );
                } catch (error) {
                  toast.error(
                    error instanceof Error
                      ? error.message
                      : t(
                          "settings:notificationsPage.toastGotifyDisconnectFailed",
                        ),
                  );
                }
              }}
              type="button"
              variant="outline"
            >
              <Trash2 className="size-4" />
              {t("settings:notificationsPage.disconnect")}
            </Button>
          ) : null}
        </div>
      </div>

      <div className="space-y-4 rounded-md border border-border bg-sidebar p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <h3 className="font-medium">
              {t("settings:notificationsPage.ntfyTitle")}
            </h3>
            <p className="text-sm text-muted-foreground">
              {t("settings:notificationsPage.ntfyDescription")}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {preferences?.ntfyConfigured ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <CheckCircle className="size-4 text-green-600" />
                <span>
                  {preferences.ntfyEnabled
                    ? t("settings:notificationsPage.statusConnected")
                    : t("settings:notificationsPage.statusPaused")}
                </span>
              </div>
            ) : null}
            <Switch
              checked={ntfyEnabled}
              disabled={isSavingPreferences}
              onCheckedChange={setNtfyEnabled}
            />
          </div>
        </div>

        <div className="space-y-4">
          <div className="space-y-1">
            <Label className="text-sm font-medium">
              {t("settings:notificationsPage.serverUrl")}
            </Label>
            <Input
              autoComplete="off"
              placeholder={t(
                "settings:notificationsPage.ntfyServerPlaceholder",
              )}
              value={ntfyServerUrl}
              onChange={(event) => setNtfyServerUrl(event.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-sm font-medium">
              {t("settings:notificationsPage.topic")}
            </Label>
            <Input
              autoComplete="off"
              placeholder={t("settings:notificationsPage.ntfyTopicPlaceholder")}
              value={ntfyTopic}
              onChange={(event) => setNtfyTopic(event.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-sm font-medium">
              {t("settings:notificationsPage.token")}
            </Label>
            <Input
              autoComplete="off"
              placeholder={t("settings:notificationsPage.ntfyTokenPlaceholder")}
              type="password"
              value={ntfyToken}
              onChange={(event) => setNtfyToken(event.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              {preferences?.ntfyTokenConfigured
                ? t("settings:notificationsPage.ntfyTokenHintConfigured", {
                    masked: preferences.maskedNtfyToken ?? "••••",
                  })
                : t("settings:notificationsPage.ntfyTokenHintOptional")}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            disabled={isSavingPreferences}
            onClick={async () => {
              try {
                await updatePreferences({
                  ntfyEnabled,
                  ntfyServerUrl,
                  ntfyTopic,
                  ntfyToken: ntfyToken.trim() ? ntfyToken : undefined,
                });
                setNtfyToken("");
                toast.success(t("settings:notificationsPage.toastNtfySaved"));
              } catch (error) {
                toast.error(
                  error instanceof Error
                    ? error.message
                    : t("settings:notificationsPage.toastNtfySaveFailed"),
                );
              }
            }}
            type="button"
          >
            {preferences?.ntfyConfigured
              ? t("settings:notificationsPage.saveChanges")
              : t("settings:notificationsPage.connectNtfy")}
          </Button>
          {preferences?.ntfyConfigured ? (
            <Button
              disabled={isSavingPreferences}
              onClick={async () => {
                try {
                  await updatePreferences({
                    ntfyEnabled: false,
                    ntfyServerUrl: null,
                    ntfyTopic: null,
                    ntfyToken: null,
                  });
                  setNtfyEnabled(false);
                  setNtfyServerUrl("");
                  setNtfyTopic("");
                  setNtfyToken("");
                  toast.success(
                    t("settings:notificationsPage.toastNtfyDisconnected"),
                  );
                } catch (error) {
                  toast.error(
                    error instanceof Error
                      ? error.message
                      : t(
                          "settings:notificationsPage.toastNtfyDisconnectFailed",
                        ),
                  );
                }
              }}
              type="button"
              variant="outline"
            >
              <Trash2 className="size-4" />
              {t("settings:notificationsPage.disconnect")}
            </Button>
          ) : null}
        </div>
      </div>

      <div className="space-y-4 rounded-md border border-border bg-sidebar p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <h3 className="font-medium">
              {t("settings:notificationsPage.webhookTitle")}
            </h3>
            <p className="text-sm text-muted-foreground">
              {t("settings:notificationsPage.webhookDescription")}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {preferences?.webhookConfigured ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <CheckCircle className="size-4 text-green-600" />
                <span>
                  {preferences.webhookEnabled
                    ? t("settings:notificationsPage.statusConnected")
                    : t("settings:notificationsPage.statusPaused")}
                </span>
              </div>
            ) : null}
            <Switch
              checked={webhookEnabled}
              disabled={isSavingPreferences}
              onCheckedChange={setWebhookEnabled}
            />
          </div>
        </div>

        <div className="space-y-4">
          <div className="space-y-1">
            <Label className="text-sm font-medium">
              {t("settings:notificationsPage.endpointUrl")}
            </Label>
            <Input
              autoComplete="off"
              placeholder={t(
                "settings:notificationsPage.webhookUrlPlaceholder",
              )}
              type="url"
              value={webhookUrl}
              onChange={(event) => setWebhookUrl(event.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-sm font-medium">
              {t("settings:notificationsPage.signingSecret")}
            </Label>
            <Input
              autoComplete="off"
              placeholder={t(
                "settings:notificationsPage.webhookSecretPlaceholder",
              )}
              type="password"
              value={webhookSecret}
              onChange={(event) => setWebhookSecret(event.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              {preferences?.webhookSecretConfigured
                ? t("settings:notificationsPage.webhookSecretHintConfigured", {
                    masked: preferences.maskedWebhookSecret ?? "••••",
                  })
                : t("settings:notificationsPage.webhookSecretHintOptional")}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            disabled={isSavingPreferences}
            onClick={async () => {
              try {
                await updatePreferences({
                  webhookEnabled,
                  webhookUrl,
                  webhookSecret: webhookSecret.trim()
                    ? webhookSecret
                    : undefined,
                });
                setWebhookSecret("");
                toast.success(
                  t("settings:notificationsPage.toastWebhookSaved"),
                );
              } catch (error) {
                toast.error(
                  error instanceof Error
                    ? error.message
                    : t("settings:notificationsPage.toastWebhookSaveFailed"),
                );
              }
            }}
            type="button"
          >
            {preferences?.webhookConfigured
              ? t("settings:notificationsPage.saveChanges")
              : t("settings:notificationsPage.connectWebhook")}
          </Button>
          {preferences?.webhookConfigured ? (
            <Button
              disabled={isSavingPreferences}
              onClick={async () => {
                try {
                  await updatePreferences({
                    webhookEnabled: false,
                    webhookUrl: null,
                    webhookSecret: null,
                  });
                  setWebhookEnabled(false);
                  setWebhookUrl("");
                  setWebhookSecret("");
                  toast.success(
                    t("settings:notificationsPage.toastWebhookDisconnected"),
                  );
                } catch (error) {
                  toast.error(
                    error instanceof Error
                      ? error.message
                      : t(
                          "settings:notificationsPage.toastWebhookDisconnectFailed",
                        ),
                  );
                }
              }}
              type="button"
              variant="outline"
            >
              <Trash2 className="size-4" />
              {t("settings:notificationsPage.disconnect")}
            </Button>
          ) : null}
        </div>
      </div>

      <div className="space-y-4">
        <div className="space-y-1">
          <h3 className="font-medium">
            {t("settings:notificationsPage.workspaceRulesTitle")}
          </h3>
          <p className="text-sm text-muted-foreground">
            {t("settings:notificationsPage.workspaceRulesDescription")}
          </p>
        </div>

        <div className="space-y-4">
          {workspaces.map((workspace) => {
            const rule = workspaceRuleMap.get(workspace.id);

            return (
              <WorkspaceRuleCard
                key={workspace.id}
                hasEmailChannel={Boolean(preferences?.emailEnabled)}
                hasGotifyChannel={Boolean(
                  preferences?.gotifyEnabled && preferences?.gotifyConfigured,
                )}
                hasNtfyChannel={Boolean(
                  preferences?.ntfyEnabled && preferences?.ntfyConfigured,
                )}
                hasWebhookChannel={Boolean(
                  preferences?.webhookEnabled && preferences?.webhookConfigured,
                )}
                onDelete={deleteWorkspaceRule}
                onSave={async (workspaceId, nextRule) => {
                  await upsertWorkspaceRule({
                    workspaceId,
                    json: nextRule,
                  });
                }}
                rule={rule}
                workspace={workspace}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
