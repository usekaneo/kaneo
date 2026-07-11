import { DEFAULT_ROLE_NAMES, statement } from "@kaneo/permissions";
import { createFileRoute } from "@tanstack/react-router";
import { Plus, Shield, Trash2, X } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import PageTitle from "@/components/page-title";
import {
  Accordion,
  AccordionItem,
  AccordionPanel,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import useCreateWorkspaceRole from "@/hooks/mutations/workspace/use-create-workspace-role";
import useDeleteWorkspaceRole from "@/hooks/mutations/workspace/use-delete-workspace-role";
import useUpdateWorkspaceRole from "@/hooks/mutations/workspace/use-update-workspace-role";
import useWorkspaceRoles, {
  type WorkspaceRole,
} from "@/hooks/queries/workspace/use-workspace-roles";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import { toast } from "@/lib/toast";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/settings/workspace/roles",
)({
  component: RouteComponent,
});

// Resources our app contributes on top of better-auth's defaults
// (organization/member/team/invitation). Derive the list from the shared
// `@kaneo/permissions` statement so adding a new resource there picks it
// up here automatically.
// "ac" is better-auth's meta-resource for managing roles themselves; we don't
// surface it. Organization/member/team/invitation are likewise managed by the
// org plugin, not by our workspace permissions UI.
const BUILT_IN_RESOURCES = new Set([
  "organization",
  "member",
  "team",
  "invitation",
  "ac",
]);
const CUSTOM_RESOURCES = (Object.keys(statement) as string[]).filter(
  (key) => !BUILT_IN_RESOURCES.has(key),
);

const RESOURCE_LABELS: Record<string, string> = {
  project: "Projects",
  task: "Tasks",
  label: "Labels",
  workspace: "Workspace",
};

const PERMISSION_LABELS: Record<
  string,
  { label: string; description: string }
> = {
  "project:create": {
    label: "Create projects",
    description: "Create new projects in this workspace.",
  },
  "project:read": {
    label: "View projects",
    description: "View projects and their details.",
  },
  "project:update": {
    label: "Edit projects",
    description: "Update project name, icon, description, and settings.",
  },
  "project:delete": {
    label: "Delete projects",
    description: "Permanently delete projects in this workspace.",
  },
  "project:share": {
    label: "Share projects",
    description: "Make projects publicly accessible via share links.",
  },
  "task:create": {
    label: "Create tasks",
    description: "Create new tasks in any project.",
  },
  "task:read": {
    label: "View tasks",
    description: "View tasks across projects.",
  },
  "task:update": {
    label: "Edit tasks",
    description: "Edit task content, status, priority, due date, and labels.",
  },
  "task:delete": {
    label: "Delete tasks",
    description: "Permanently delete tasks.",
  },
  "task:assign": {
    label: "Assign tasks",
    description: "Assign tasks to other workspace members.",
  },
  "label:create": {
    label: "Create labels",
    description: "Add new labels to tasks in this workspace.",
  },
  "label:read": {
    label: "View labels",
    description: "View labels attached to tasks.",
  },
  "label:update": {
    label: "Edit labels",
    description: "Rename, recolor, and reassign labels.",
  },
  "label:delete": {
    label: "Delete labels",
    description: "Permanently delete labels from this workspace.",
  },
  "workspace:read": {
    label: "Access workspace",
    description: "Read workspace metadata and members.",
  },
  "workspace:update": {
    label: "Edit workspace",
    description: "Edit workspace name and description.",
  },
  "workspace:delete": {
    label: "Delete workspace",
    description: "Permanently delete this workspace.",
  },
  "workspace:manage_settings": {
    label: "Manage settings",
    description:
      "Configure integrations, notification rules, and workspace preferences.",
  },
};

// Default roles are seeded per workspace by the API (see
// `seedDefaultWorkspaceRoles` and the afterCreateOrganization hook). They show
// up in `customRoles` like any other dynamic role but get a "Default" badge,
// can't be deleted, and reserve their names against new custom roles. Owner
// stays a static role on the auth side and is hidden from this UI, but its
// name is still reserved here.
const DEFAULT_ROLE_NAME_SET = new Set<string>(DEFAULT_ROLE_NAMES);
const RESERVED_ROLE_NAMES = [...DEFAULT_ROLE_NAMES, "owner"];

const DEFAULT_ROLE_DESCRIPTIONS: Record<string, string> = {
  viewer: "Read-only access to projects, tasks, and workspace.",
  member: "Can create and update projects and tasks.",
  admin: "Full project and task management plus workspace settings.",
};

function isDefaultRole(name: string) {
  return DEFAULT_ROLE_NAME_SET.has(name);
}

function permissionsEqual(
  a: Record<string, string[]>,
  b: Record<string, string[]>,
): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of keys) {
    const arrA = [...(a[key] ?? [])].sort();
    const arrB = [...(b[key] ?? [])].sort();
    if (arrA.length !== arrB.length) return false;
    for (let i = 0; i < arrA.length; i++) {
      if (arrA[i] !== arrB[i]) return false;
    }
  }
  return true;
}

function permissionCount(permissions: Record<string, string[] | undefined>) {
  return Object.values(permissions).reduce(
    (sum, actions) => sum + (actions?.length ?? 0),
    0,
  );
}

function RouteComponent() {
  const { t } = useTranslation();
  const { workspace, isAdmin } = useWorkspacePermission();
  const workspaceId = workspace?.id ?? "";
  const {
    data: customRoles = [],
    isLoading,
    isError: customRolesError,
    error: customRolesErrorValue,
  } = useWorkspaceRoles(workspaceId);
  const [draftActive, setDraftActive] = useState(false);
  const [roleToDelete, setRoleToDelete] = useState<WorkspaceRole | null>(null);
  const [openCustom, setOpenCustom] = useState<string[]>([]);

  // Defaults (viewer/member/admin) first so they anchor the list, then
  // user-created roles in their natural order.
  const sortedRoles = useMemo(() => {
    const defaults: WorkspaceRole[] = [];
    const custom: WorkspaceRole[] = [];
    for (const role of customRoles) {
      if (isDefaultRole(role.role)) defaults.push(role);
      else custom.push(role);
    }
    defaults.sort(
      (a, b) =>
        DEFAULT_ROLE_NAMES.indexOf(a.role as never) -
        DEFAULT_ROLE_NAMES.indexOf(b.role as never),
    );
    return [...defaults, ...custom];
  }, [customRoles]);

  if (!isAdmin) {
    return (
      <>
        <PageTitle title={t("settings:workspaceRoles.pageTitle")} />
        <div className="max-w-4xl mx-auto space-y-8">
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold">
              {t("settings:workspaceRoles.title")}
            </h1>
            <p className="text-muted-foreground">
              {t("settings:workspaceRoles.noAccess")}
            </p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <PageTitle title={t("settings:workspaceRoles.pageTitle")} />
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold">
            {t("settings:workspaceRoles.title")}
          </h1>
          <p className="text-muted-foreground">
            {t("settings:workspaceRoles.subtitle", {
              workspaceName:
                workspace?.name ?? t("settings:workspaceRoles.thisWorkspace"),
            })}
          </p>
        </div>

        <div className="space-y-6">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <h2 className="text-md font-medium">
                {t("settings:workspaceRoles.sectionTitle")}
              </h2>
              <p className="text-xs text-muted-foreground">
                {t("settings:workspaceRoles.sectionSubtitle")}
              </p>
            </div>
            <Button
              size="sm"
              className="gap-1.5"
              onClick={() => {
                setDraftActive(true);
                setOpenCustom((prev) =>
                  prev.includes("__draft__") ? prev : [...prev, "__draft__"],
                );
              }}
              disabled={draftActive}
            >
              <Plus className="w-3.5 h-3.5" />
              {t("settings:workspaceRoles.newRole")}
            </Button>
          </div>
          <div className="border border-border rounded-md bg-sidebar">
            {isLoading && !draftActive ? (
              <p className="text-xs text-muted-foreground px-4 py-6">
                {t("settings:workspaceRoles.loading")}
              </p>
            ) : customRolesError ? (
              <p className="text-xs text-destructive px-4 py-6">
                {customRolesErrorValue instanceof Error
                  ? customRolesErrorValue.message
                  : t("settings:workspaceRoles.loadError")}
              </p>
            ) : sortedRoles.length === 0 && !draftActive ? (
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <Shield />
                  </EmptyMedia>
                  <EmptyTitle>
                    {t("settings:workspaceRoles.emptyTitle")}
                  </EmptyTitle>
                  <EmptyDescription>
                    {t("settings:workspaceRoles.emptyDescription")}
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <Accordion
                openMultiple
                value={openCustom}
                onValueChange={(value) =>
                  setOpenCustom(Array.isArray(value) ? value : [value])
                }
              >
                {draftActive && (
                  <AccordionItem
                    value="__draft__"
                    className="border-b border-border last:border-b-0"
                  >
                    <AccordionTrigger className="px-4">
                      <div className="flex items-center gap-3 min-w-0">
                        <Shield className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        <p className="text-sm font-medium italic">
                          {t("settings:workspaceRoles.newRole")}
                        </p>
                      </div>
                    </AccordionTrigger>
                    <AccordionPanel className="px-0 pt-0 pb-0">
                      <DraftEditor
                        workspaceId={workspaceId}
                        existingNames={[
                          ...RESERVED_ROLE_NAMES,
                          ...customRoles.map((r) => r.role),
                        ]}
                        onCreated={(roleName) => {
                          setDraftActive(false);
                          setOpenCustom((prev) => [
                            ...prev.filter((v) => v !== "__draft__"),
                            roleName,
                          ]);
                        }}
                        onDiscard={() => {
                          setDraftActive(false);
                          setOpenCustom((prev) =>
                            prev.filter((v) => v !== "__draft__"),
                          );
                        }}
                      />
                    </AccordionPanel>
                  </AccordionItem>
                )}
                {sortedRoles.map((role) => {
                  const isDefault = isDefaultRole(role.role);
                  const roleLabel = isDefault
                    ? t(`team:roles.${role.role}`, {
                        defaultValue: role.role,
                      })
                    : role.role;
                  const description = isDefault
                    ? t(
                        `settings:workspaceRoles.defaultRoleDescriptions.${role.role}`,
                        {
                          defaultValue:
                            DEFAULT_ROLE_DESCRIPTIONS[role.role] ?? "",
                        },
                      )
                    : undefined;
                  return (
                    <AccordionItem
                      key={role.id}
                      value={role.role}
                      className="border-b border-border last:border-b-0"
                    >
                      <AccordionTrigger className="px-4">
                        <div className="flex items-center justify-between gap-4 flex-1 min-w-0">
                          <div className="flex items-center gap-3 min-w-0">
                            <Shield className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <p
                                  className={`text-sm font-medium truncate ${
                                    isDefault ? "" : "capitalize"
                                  }`}
                                >
                                  {roleLabel}
                                </p>
                                {isDefault && (
                                  <span className="text-[10px] uppercase tracking-wide font-medium px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                                    {t("settings:workspaceRoles.defaultBadge")}
                                  </span>
                                )}
                              </div>
                              {description && (
                                <p className="text-xs font-normal text-muted-foreground truncate">
                                  {description}
                                </p>
                              )}
                            </div>
                          </div>
                          <p className="text-xs font-normal text-muted-foreground shrink-0">
                            {t("settings:workspaceRoles.permissionCount", {
                              count: permissionCount(role.permission),
                            })}
                          </p>
                        </div>
                      </AccordionTrigger>
                      <AccordionPanel className="px-0 pt-0 pb-0">
                        <CustomRoleEditor
                          key={role.id}
                          workspaceId={workspaceId}
                          role={role}
                          isDefault={isDefault}
                          onDelete={() => setRoleToDelete(role)}
                        />
                      </AccordionPanel>
                    </AccordionItem>
                  );
                })}
              </Accordion>
            )}
          </div>
        </div>
      </div>

      <AlertDialog
        open={!!roleToDelete}
        onOpenChange={(open) => !open && setRoleToDelete(null)}
      >
        <DeleteRoleConfirm
          role={roleToDelete}
          workspaceId={workspaceId}
          onDeleted={() => {
            setOpenCustom((prev) =>
              prev.filter((v) => v !== roleToDelete?.role),
            );
            setRoleToDelete(null);
          }}
          onCancel={() => setRoleToDelete(null)}
        />
      </AlertDialog>
    </>
  );
}

function PermissionList({
  permissions,
  selected,
  onToggle,
  readOnly,
  disabled,
}: {
  permissions: Partial<Record<string, string[]>>;
  selected?: Record<string, Set<string>>;
  onToggle?: (resource: string, action: string) => void;
  readOnly?: boolean;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const groups = useMemo(
    () =>
      CUSTOM_RESOURCES.map((resource) => ({
        resource,
        actions: [...(statement[resource] ?? [])] as string[],
      })),
    [],
  );

  const isChecked = (resource: string, action: string) => {
    if (selected) return selected[resource]?.has(action) ?? false;
    return permissions[resource]?.includes(action) ?? false;
  };

  return (
    <div className="border-t border-border">
      {groups.map(({ resource, actions }, groupIndex) => (
        <div key={resource}>
          {groupIndex > 0 && <Separator />}
          <div className="space-y-4 p-4">
            <p className="text-sm font-medium capitalize">
              {t(`settings:workspaceRoles.resources.${resource}`, {
                defaultValue:
                  RESOURCE_LABELS[resource] ??
                  resource.charAt(0).toUpperCase() + resource.slice(1),
              })}
            </p>
            <div className="space-y-4">
              {actions.map((action, idx) => {
                const meta = PERMISSION_LABELS[`${resource}:${action}`] ?? {
                  label: `${action} ${resource}`,
                  description: "",
                };
                const labelKey = `${resource}.${action}.label`;
                const descriptionKey = `${resource}.${action}.description`;
                return (
                  <div key={`${resource}:${action}`}>
                    {idx > 0 && <Separator className="mb-4" />}
                    <div className="flex items-center justify-between gap-6">
                      <div className="space-y-0.5 flex-1 min-w-0">
                        <Label className="text-sm font-medium">
                          {t(
                            `settings:workspaceRoles.permissions.${labelKey}`,
                            {
                              defaultValue: meta.label,
                            },
                          )}
                        </Label>
                        {meta.description && (
                          <p className="text-xs text-muted-foreground">
                            {t(
                              `settings:workspaceRoles.permissions.${descriptionKey}`,
                              {
                                defaultValue: meta.description,
                              },
                            )}
                          </p>
                        )}
                      </div>
                      <Switch
                        checked={isChecked(resource, action)}
                        onCheckedChange={
                          readOnly || !onToggle
                            ? undefined
                            : () => onToggle(resource, action)
                        }
                        disabled={readOnly || disabled}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function DraftEditor({
  workspaceId,
  existingNames,
  onCreated,
  onDiscard,
}: {
  workspaceId: string;
  existingNames: string[];
  onCreated: (roleName: string) => void;
  onDiscard: () => void;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [permissions, setPermissions] = useState<Record<string, Set<string>>>(
    {},
  );
  const { mutateAsync: createRole, isPending } = useCreateWorkspaceRole();

  const togglePermission = (resource: string, action: string) => {
    setPermissions((prev) => {
      const next = { ...prev };
      const set = new Set(next[resource] ?? []);
      if (set.has(action)) set.delete(action);
      else set.add(action);
      next[resource] = set;
      return next;
    });
  };

  const handleCreate = async () => {
    const trimmed = name.trim().toLowerCase();
    if (!trimmed) {
      toast.error(t("settings:workspaceRoles.validation.nameRequired"));
      return;
    }
    if (existingNames.map((n) => n.toLowerCase()).includes(trimmed)) {
      toast.error(t("settings:workspaceRoles.validation.nameExists"));
      return;
    }
    const permission: Record<string, string[]> = {};
    for (const [r, set] of Object.entries(permissions)) {
      if (set.size > 0) permission[r] = Array.from(set);
    }
    if (Object.keys(permission).length === 0) {
      toast.error(t("settings:workspaceRoles.validation.permissionRequired"));
      return;
    }
    try {
      await createRole({ workspaceId, role: trimmed, permission });
      toast.success(t("settings:workspaceRoles.toast.created"));
      onCreated(trimmed);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("settings:workspaceRoles.toast.createError"),
      );
    }
  };

  return (
    <div>
      <div className="border-t border-border">
        <div className="flex items-center justify-between gap-4 px-4 py-3">
          <div className="space-y-0.5">
            <Label className="text-sm font-medium">
              {t("settings:workspaceRoles.nameLabel")}
            </Label>
            <p className="text-xs text-muted-foreground">
              {t("settings:workspaceRoles.nameHint")}
            </p>
          </div>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("settings:workspaceRoles.namePlaceholder")}
            className="w-64"
            autoFocus
            disabled={isPending}
          />
        </div>
      </div>
      <div className="max-h-[60vh] overflow-y-auto">
        <PermissionList
          permissions={{}}
          selected={permissions}
          onToggle={togglePermission}
          disabled={isPending}
        />
      </div>
      <Separator />
      <div className="flex justify-end gap-2 px-4 py-3 bg-sidebar">
        <Button
          variant="ghost"
          size="sm"
          onClick={onDiscard}
          disabled={isPending}
        >
          <X className="w-4 h-4" />
          {t("settings:workspaceRoles.discard")}
        </Button>
        <Button size="sm" onClick={handleCreate} disabled={isPending}>
          {t("settings:workspaceRoles.createRole")}
        </Button>
      </div>
    </div>
  );
}

function CustomRoleEditor({
  workspaceId,
  role,
  isDefault,
  onDelete,
}: {
  workspaceId: string;
  role: WorkspaceRole;
  isDefault?: boolean;
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  const [permissions, setPermissions] = useState<Record<string, Set<string>>>(
    () => {
      const out: Record<string, Set<string>> = {};
      for (const [r, actions] of Object.entries(role.permission)) {
        out[r] = new Set(actions);
      }
      return out;
    },
  );
  const { mutateAsync: updateRole, isPending } = useUpdateWorkspaceRole();

  const currentPermissions = useMemo(() => {
    const out: Record<string, string[]> = {};
    for (const [r, set] of Object.entries(permissions)) {
      if (set.size > 0) out[r] = Array.from(set);
    }
    return out;
  }, [permissions]);

  const dirty = !permissionsEqual(currentPermissions, role.permission);

  const togglePermission = (resource: string, action: string) => {
    setPermissions((prev) => {
      const next = { ...prev };
      const set = new Set(next[resource] ?? []);
      if (set.has(action)) set.delete(action);
      else set.add(action);
      next[resource] = set;
      return next;
    });
  };

  const handleSave = async () => {
    if (Object.keys(currentPermissions).length === 0) {
      toast.error(t("settings:workspaceRoles.validation.permissionRequired"));
      return;
    }
    try {
      await updateRole({
        workspaceId,
        roleName: role.role,
        permission: currentPermissions,
      });
      toast.success(t("settings:workspaceRoles.toast.updated"));
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("settings:workspaceRoles.toast.updateError"),
      );
    }
  };

  // AccordionPanel sets `overflow-hidden`, which kills `position: sticky`
  // relative to the page. Instead, we cap the permission list height and
  // give it its own scroll, so the action bar below stays anchored at the
  // bottom of the accordion content while the user scrolls through
  // permissions.
  return (
    <div>
      <div className="max-h-[60vh] overflow-y-auto">
        <PermissionList
          permissions={role.permission}
          selected={permissions}
          onToggle={togglePermission}
          disabled={isPending}
        />
      </div>
      <Separator />
      <div className="flex items-center justify-between gap-2 px-4 py-3 bg-sidebar">
        {isDefault ? (
          <span className="text-xs text-muted-foreground">
            {t("settings:workspaceRoles.defaultRoleHelp")}
          </span>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            onClick={onDelete}
            className="text-destructive hover:text-destructive"
            disabled={isPending}
          >
            <Trash2 className="w-4 h-4" />
            {t("settings:workspaceRoles.deleteRole")}
          </Button>
        )}
        <div className="flex items-center gap-3">
          <p className="text-xs text-muted-foreground">
            {dirty
              ? t("settings:workspaceRoles.unsavedChanges")
              : t("settings:workspaceRoles.allChangesSaved")}
          </p>
          <Button size="sm" onClick={handleSave} disabled={isPending || !dirty}>
            {t("settings:workspaceRoles.saveChanges")}
          </Button>
        </div>
      </div>
    </div>
  );
}

function DeleteRoleConfirm({
  role,
  workspaceId,
  onDeleted,
  onCancel,
}: {
  role: WorkspaceRole | null;
  workspaceId: string;
  onDeleted: () => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const { mutateAsync: deleteRole, isPending } = useDeleteWorkspaceRole();

  return (
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>
          {t("settings:workspaceRoles.deleteDialog.title")}
        </AlertDialogTitle>
        <AlertDialogDescription>
          {role
            ? t("settings:workspaceRoles.deleteDialog.description", {
                role: role.role,
              })
            : ""}
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogClose disabled={isPending}>
          <Button
            variant="outline"
            size="sm"
            disabled={isPending}
            onClick={onCancel}
          >
            {t("common:actions.cancel")}
          </Button>
        </AlertDialogClose>
        <Button
          variant="destructive"
          size="sm"
          disabled={isPending || !role}
          onClick={async () => {
            if (!role) return;
            try {
              await deleteRole({ workspaceId, roleName: role.role });
              toast.success(t("settings:workspaceRoles.toast.deleted"));
              // Caller closes the dialog after the mutation succeeds so a
              // failed delete leaves the confirmation visible.
              onDeleted();
            } catch (error) {
              toast.error(
                error instanceof Error
                  ? error.message
                  : t("settings:workspaceRoles.toast.deleteError"),
              );
            }
          }}
        >
          <Trash2 className="w-4 h-4 mr-2" />
          {t("common:actions.delete")}
        </Button>
      </AlertDialogFooter>
    </AlertDialogContent>
  );
}
