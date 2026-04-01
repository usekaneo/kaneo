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

type GlobalChannelPrefsState = {
  emailEnabled: boolean;
  ntfy: { enabled: boolean; serverUrl: string; topic: string; token: string };
  gotify: { enabled: boolean; serverUrl: string; token: string };
  webhook: { enabled: boolean; url: string; secret: string };
};

function createDefaultGlobalChannelPrefs(): GlobalChannelPrefsState {
  return {
    emailEnabled: false,
    ntfy: { enabled: false, serverUrl: "", topic: "", token: "" },
    gotify: { enabled: false, serverUrl: "", token: "" },
    webhook: { enabled: false, url: "", secret: "" },
  };
}

function ChannelCard({
  actions,
  channel,
  children,
  description,
  headerRight,
  title,
}: {
  channel: "email" | "gotify" | "ntfy" | "webhook";
  title: React.ReactNode;
  description: React.ReactNode;
  headerRight: React.ReactNode;
  children: React.ReactNode;
  actions: React.ReactNode;
}) {
  return (
    <div
      className="space-y-4 rounded-md border border-border bg-sidebar p-4"
      data-channel={channel}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h3 className="font-medium">{title}</h3>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        {headerRight}
      </div>
      {children}
      {actions}
    </div>
  );
}

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
            setIsSaving(true);
            try {
              await onSave(workspace.id, state);
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
              setIsDeleting(true);
              try {
                await onDelete(workspace.id);
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

  const [globalPrefs, setGlobalPrefs] = React.useState<GlobalChannelPrefsState>(
    createDefaultGlobalChannelPrefs,
  );

  React.useEffect(() => {
    if (!preferences) return;
    setGlobalPrefs({
      emailEnabled: preferences.emailEnabled,
      ntfy: {
        enabled: preferences.ntfyEnabled,
        serverUrl: preferences.ntfyServerUrl ?? "",
        topic: preferences.ntfyTopic ?? "",
        token: "",
      },
      gotify: {
        enabled: preferences.gotifyEnabled,
        serverUrl: preferences.gotifyServerUrl ?? "",
        token: "",
      },
      webhook: {
        enabled: preferences.webhookEnabled,
        url: preferences.webhookUrl ?? "",
        secret: "",
      },
    });
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
      <ChannelCard
        actions={
          <div className="flex gap-2">
            <Button
              disabled={isSavingPreferences || !preferences?.emailAddress}
              onClick={async () => {
                await updatePreferences({
                  emailEnabled: globalPrefs.emailEnabled,
                });
              }}
              type="button"
            >
              {t("settings:notificationsPage.saveChanges")}
            </Button>
          </div>
        }
        channel="email"
        description={t("settings:notificationsPage.emailDescription")}
        headerRight={
          <div className="flex items-center gap-3">
            {preferences?.emailEnabled ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <CheckCircle className="size-4 text-green-600" />
                <span>{t("settings:notificationsPage.statusConnected")}</span>
              </div>
            ) : null}
            <Switch
              checked={globalPrefs.emailEnabled}
              disabled={isSavingPreferences || !preferences?.emailAddress}
              onCheckedChange={(checked) =>
                setGlobalPrefs((prev) => ({ ...prev, emailEnabled: checked }))
              }
            />
          </div>
        }
        title={t("settings:notificationsPage.emailTitle")}
      >
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
      </ChannelCard>

      <ChannelCard
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={isSavingPreferences}
              onClick={async () => {
                await updatePreferences({
                  gotifyEnabled: globalPrefs.gotify.enabled,
                  gotifyServerUrl: globalPrefs.gotify.serverUrl,
                  gotifyToken: globalPrefs.gotify.token.trim()
                    ? globalPrefs.gotify.token
                    : undefined,
                });
                setGlobalPrefs((prev) => ({
                  ...prev,
                  gotify: { ...prev.gotify, token: "" },
                }));
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
                  await updatePreferences({
                    gotifyEnabled: false,
                    gotifyServerUrl: null,
                    gotifyToken: null,
                  });
                  setGlobalPrefs((prev) => ({
                    ...prev,
                    gotify: {
                      enabled: false,
                      serverUrl: "",
                      token: "",
                    },
                  }));
                }}
                type="button"
                variant="outline"
              >
                <Trash2 className="size-4" />
                {t("settings:notificationsPage.disconnect")}
              </Button>
            ) : null}
          </div>
        }
        channel="gotify"
        description={t("settings:notificationsPage.gotifyDescription")}
        headerRight={
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
              checked={globalPrefs.gotify.enabled}
              disabled={isSavingPreferences}
              onCheckedChange={(checked) =>
                setGlobalPrefs((prev) => ({
                  ...prev,
                  gotify: { ...prev.gotify, enabled: checked },
                }))
              }
            />
          </div>
        }
        title={t("settings:notificationsPage.gotifyTitle")}
      >
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
              value={globalPrefs.gotify.serverUrl}
              onChange={(event) =>
                setGlobalPrefs((prev) => ({
                  ...prev,
                  gotify: { ...prev.gotify, serverUrl: event.target.value },
                }))
              }
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
              value={globalPrefs.gotify.token}
              onChange={(event) =>
                setGlobalPrefs((prev) => ({
                  ...prev,
                  gotify: { ...prev.gotify, token: event.target.value },
                }))
              }
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
      </ChannelCard>

      <ChannelCard
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={isSavingPreferences}
              onClick={async () => {
                await updatePreferences({
                  ntfyEnabled: globalPrefs.ntfy.enabled,
                  ntfyServerUrl: globalPrefs.ntfy.serverUrl,
                  ntfyTopic: globalPrefs.ntfy.topic,
                  ntfyToken: globalPrefs.ntfy.token.trim()
                    ? globalPrefs.ntfy.token
                    : undefined,
                });
                setGlobalPrefs((prev) => ({
                  ...prev,
                  ntfy: { ...prev.ntfy, token: "" },
                }));
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
                  await updatePreferences({
                    ntfyEnabled: false,
                    ntfyServerUrl: null,
                    ntfyTopic: null,
                    ntfyToken: null,
                  });
                  setGlobalPrefs((prev) => ({
                    ...prev,
                    ntfy: {
                      enabled: false,
                      serverUrl: "",
                      topic: "",
                      token: "",
                    },
                  }));
                }}
                type="button"
                variant="outline"
              >
                <Trash2 className="size-4" />
                {t("settings:notificationsPage.disconnect")}
              </Button>
            ) : null}
          </div>
        }
        channel="ntfy"
        description={t("settings:notificationsPage.ntfyDescription")}
        headerRight={
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
              checked={globalPrefs.ntfy.enabled}
              disabled={isSavingPreferences}
              onCheckedChange={(checked) =>
                setGlobalPrefs((prev) => ({
                  ...prev,
                  ntfy: { ...prev.ntfy, enabled: checked },
                }))
              }
            />
          </div>
        }
        title={t("settings:notificationsPage.ntfyTitle")}
      >
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
              value={globalPrefs.ntfy.serverUrl}
              onChange={(event) =>
                setGlobalPrefs((prev) => ({
                  ...prev,
                  ntfy: { ...prev.ntfy, serverUrl: event.target.value },
                }))
              }
            />
          </div>
          <div className="space-y-1">
            <Label className="text-sm font-medium">
              {t("settings:notificationsPage.topic")}
            </Label>
            <Input
              autoComplete="off"
              placeholder={t("settings:notificationsPage.ntfyTopicPlaceholder")}
              value={globalPrefs.ntfy.topic}
              onChange={(event) =>
                setGlobalPrefs((prev) => ({
                  ...prev,
                  ntfy: { ...prev.ntfy, topic: event.target.value },
                }))
              }
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
              value={globalPrefs.ntfy.token}
              onChange={(event) =>
                setGlobalPrefs((prev) => ({
                  ...prev,
                  ntfy: { ...prev.ntfy, token: event.target.value },
                }))
              }
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
      </ChannelCard>

      <ChannelCard
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={isSavingPreferences}
              onClick={async () => {
                await updatePreferences({
                  webhookEnabled: globalPrefs.webhook.enabled,
                  webhookUrl: globalPrefs.webhook.url,
                  webhookSecret: globalPrefs.webhook.secret.trim()
                    ? globalPrefs.webhook.secret
                    : undefined,
                });
                setGlobalPrefs((prev) => ({
                  ...prev,
                  webhook: { ...prev.webhook, secret: "" },
                }));
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
                  await updatePreferences({
                    webhookEnabled: false,
                    webhookUrl: null,
                    webhookSecret: null,
                  });
                  setGlobalPrefs((prev) => ({
                    ...prev,
                    webhook: {
                      enabled: false,
                      url: "",
                      secret: "",
                    },
                  }));
                }}
                type="button"
                variant="outline"
              >
                <Trash2 className="size-4" />
                {t("settings:notificationsPage.disconnect")}
              </Button>
            ) : null}
          </div>
        }
        channel="webhook"
        description={t("settings:notificationsPage.webhookDescription")}
        headerRight={
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
              checked={globalPrefs.webhook.enabled}
              disabled={isSavingPreferences}
              onCheckedChange={(checked) =>
                setGlobalPrefs((prev) => ({
                  ...prev,
                  webhook: { ...prev.webhook, enabled: checked },
                }))
              }
            />
          </div>
        }
        title={t("settings:notificationsPage.webhookTitle")}
      >
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
              value={globalPrefs.webhook.url}
              onChange={(event) =>
                setGlobalPrefs((prev) => ({
                  ...prev,
                  webhook: { ...prev.webhook, url: event.target.value },
                }))
              }
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
              value={globalPrefs.webhook.secret}
              onChange={(event) =>
                setGlobalPrefs((prev) => ({
                  ...prev,
                  webhook: { ...prev.webhook, secret: event.target.value },
                }))
              }
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
      </ChannelCard>

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
