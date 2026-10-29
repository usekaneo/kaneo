import {
  Activity,
  Bell,
  Building2,
  Code,
  CreditCard,
  Import,
  KeyRound,
  LayoutDashboard,
  ScrollText,
  Server,
  Settings,
  Settings2,
  Shield,
  ShieldCheck,
  SlidersHorizontal,
  Tag,
  User,
  Webhook,
} from "lucide-react";
import type { InstancePermission } from "@kaneo/permissions";
import {
  canAccessAdminPage,
  type AdminPage,
} from "@/components/admin/admin-page-access";
import projectIcons from "@/constants/project-icons";
import type {
  SettingsNav,
  SettingsNavProject,
} from "@/components/settings/nav/types";

type Translate = (key: string) => string;

type BuildSettingsNavInput = {
  t: Translate;
  workspaceName?: string;
  billingEnabled: boolean;
  canImport: boolean;
  /** The signed-in user's instance permissions. */
  adminPermissions: readonly InstancePermission[];
  projects: { id: string; name: string; icon?: string | null }[];
};

const ADMIN_LINKS = [
  {
    id: "admin-overview",
    labelKey: "settings:adminOverview.title",
    to: "/dashboard/settings/admin/overview",
    icon: LayoutDashboard,
  },
  {
    id: "admin-users",
    labelKey: "settings:adminUsers.title",
    to: "/dashboard/settings/admin/users",
    icon: Server,
  },
  {
    id: "admin-roles",
    labelKey: "settings:adminRoles.title",
    to: "/dashboard/settings/admin/roles",
    icon: ShieldCheck,
  },
  {
    id: "admin-workspaces",
    labelKey: "settings:adminWorkspaces.title",
    to: "/dashboard/settings/admin/workspaces",
    icon: Building2,
  },
  {
    id: "admin-audit-log",
    labelKey: "settings:adminAuditLog.title",
    to: "/dashboard/settings/admin/audit-log",
    icon: ScrollText,
  },
  {
    id: "admin-system",
    labelKey: "settings:adminSystem.title",
    to: "/dashboard/settings/admin/system",
    icon: Activity,
  },
  {
    id: "admin-settings",
    labelKey: "settings:adminSettings.title",
    to: "/dashboard/settings/admin/settings",
    icon: Settings2,
  },
  {
    id: "admin-webhooks",
    labelKey: "settings:adminWebhooks.title",
    to: "/dashboard/settings/admin/webhooks",
    icon: Webhook,
  },
] as const satisfies readonly {
  id: string;
  labelKey: string;
  to: AdminPage;
  icon: unknown;
}[];

const PROJECT_SECTIONS = [
  { id: "general", labelKey: "settings:projectGeneral.title" },
  { id: "workflow", labelKey: "settings:projectWorkflow.title" },
  { id: "custom-fields", labelKey: "settings:projectCustomFields.title" },
  { id: "visibility", labelKey: "settings:projectVisibility.title" },
  { id: "integrations", labelKey: "settings:projectIntegrations.title" },
  { id: "calendar", labelKey: "settings:calendarFeeds.title" },
] as const;

function buildProject(
  t: Translate,
  project: BuildSettingsNavInput["projects"][number],
): SettingsNavProject {
  const icon =
    projectIcons[project.icon as keyof typeof projectIcons] ??
    projectIcons.Layout;

  return {
    id: project.id,
    name: project.name,
    icon,
    links: PROJECT_SECTIONS.map((section) => ({
      id: `project-${project.id}-${section.id}`,
      label: t(section.labelKey),
      to: `/dashboard/settings/projects/${project.id}/${section.id}`,
    })),
  };
}

export function buildSettingsNav({
  t,
  workspaceName,
  billingEnabled,
  canImport,
  adminPermissions,
  projects,
}: BuildSettingsNavInput): SettingsNav {
  const adminLinks = ADMIN_LINKS.filter((link) =>
    canAccessAdminPage(link.to, adminPermissions),
  ).map(({ labelKey, ...link }) => ({
    ...link,
    label: t(labelKey),
  }));

  return {
    account: {
      id: "account",
      label: t("settings:account"),
      links: [
        {
          id: "information",
          label: t("settings:information"),
          to: "/dashboard/settings/account/information",
          icon: User,
        },
        {
          id: "preferences",
          label: t("settings:preferences"),
          to: "/dashboard/settings/account/preferences",
          icon: SlidersHorizontal,
        },
        {
          id: "notifications",
          label: t("settings:notifications"),
          to: "/dashboard/settings/account/notifications",
          icon: Bell,
        },
        {
          id: "security",
          label: t("settings:security"),
          to: "/dashboard/settings/account/security",
          icon: KeyRound,
        },
        {
          id: "developer",
          label: t("settings:apiKeys"),
          to: "/dashboard/settings/account/developer",
          icon: Code,
        },
      ],
    },
    workspace: {
      id: "workspace",
      label: workspaceName || t("navigation:page.settingsWorkspaceTab"),
      links: [
        {
          id: "workspace-general",
          label: t("settings:workspaceGeneral.title"),
          to: "/dashboard/settings/workspace/general",
          icon: Settings,
        },
        {
          id: "workspace-roles",
          label: t("settings:workspaceRoles.title"),
          to: "/dashboard/settings/workspace/roles",
          icon: Shield,
        },
        {
          id: "workspace-labels",
          label: t("settings:workspaceLabels.title"),
          to: "/dashboard/settings/workspace/labels",
          icon: Tag,
        },
        ...(canImport
          ? [
              {
                id: "workspace-import",
                label: t("settings:workspaceImport.title"),
                to: "/dashboard/settings/workspace/import",
                icon: Import,
              },
            ]
          : []),
        ...(billingEnabled
          ? [
              {
                id: "workspace-billing",
                label: t("settings:billing.pageTitle"),
                to: "/dashboard/settings/workspace/billing",
                icon: CreditCard,
              },
            ]
          : []),
      ],
    },
    projects: projects.map((project) => buildProject(t, project)),
    admin:
      adminLinks.length > 0
        ? {
            id: "admin",
            label: t("settings:administration"),
            links: adminLinks,
          }
        : null,
  };
}
