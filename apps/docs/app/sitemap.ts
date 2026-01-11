import type { MetadataRoute } from "next";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = "https://kaneo.app";

  const staticPages = [
    // Homepage
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: "weekly" as const,
      priority: 1,
    },
    {
      url: "https://cloud.kaneo.app/public-project/vlu4ak2w8rs9rn1r4lirj2u1",
      lastModified: new Date(),
      changeFrequency: "weekly" as const,
      priority: 1,
    },

    // Main sections
    {
      url: `${baseUrl}/docs/core`,
      lastModified: new Date(),
      changeFrequency: "weekly" as const,
      priority: 0.9,
    },
    {
      url: `${baseUrl}/docs/api`,
      lastModified: new Date(),
      changeFrequency: "weekly" as const,
      priority: 0.9,
    },
    {
      url: `${baseUrl}/docs/core/alternatives`,
      lastModified: new Date(),
      changeFrequency: "monthly" as const,
      priority: 0.9,
    },

    // Installation
    {
      url: `${baseUrl}/docs/core/installation`,
      lastModified: new Date(),
      changeFrequency: "monthly" as const,
      priority: 0.9,
    },
    {
      url: `${baseUrl}/docs/core/installation/docker-compose`,
      lastModified: new Date(),
      changeFrequency: "monthly" as const,
      priority: 0.8,
    },
    {
      url: `${baseUrl}/docs/core/installation/drim`,
      lastModified: new Date(),
      changeFrequency: "monthly" as const,
      priority: 0.8,
    },
    {
      url: `${baseUrl}/docs/core/installation/environment-variables`,
      lastModified: new Date(),
      changeFrequency: "monthly" as const,
      priority: 0.8,
    },
    {
      url: `${baseUrl}/docs/core/installation/start-services`,
      lastModified: new Date(),
      changeFrequency: "monthly" as const,
      priority: 0.8,
    },

    // Integrations
    {
      url: `${baseUrl}/docs/core/integrations/github`,
      lastModified: new Date(),
      changeFrequency: "monthly" as const,
      priority: 0.8,
    },
    {
      url: `${baseUrl}/docs/core/integrations/github/setup`,
      lastModified: new Date(),
      changeFrequency: "monthly" as const,
      priority: 0.7,
    },
    {
      url: `${baseUrl}/docs/core/integrations/github/configuration`,
      lastModified: new Date(),
      changeFrequency: "monthly" as const,
      priority: 0.7,
    },
    {
      url: `${baseUrl}/docs/core/integrations/github/troubleshooting`,
      lastModified: new Date(),
      changeFrequency: "monthly" as const,
      priority: 0.7,
    },

    // Social Providers
    {
      url: `${baseUrl}/docs/core/social-providers/github`,
      lastModified: new Date(),
      changeFrequency: "monthly" as const,
      priority: 0.8,
    },
    {
      url: `${baseUrl}/docs/core/social-providers/google`,
      lastModified: new Date(),
      changeFrequency: "monthly" as const,
      priority: 0.8,
    },
    {
      url: `${baseUrl}/docs/core/social-providers/discord`,
      lastModified: new Date(),
      changeFrequency: "monthly" as const,
      priority: 0.8,
    },
    {
      url: `${baseUrl}/docs/core/social-providers/custom-oauth`,
      lastModified: new Date(),
      changeFrequency: "monthly" as const,
      priority: 0.8,
    },

    // Reverse Proxy
    {
      url: `${baseUrl}/docs/core/reverse-proxy/nginx`,
      lastModified: new Date(),
      changeFrequency: "monthly" as const,
      priority: 0.8,
    },

    // Deployments
    {
      url: `${baseUrl}/docs/core/deployments/railway`,
      lastModified: new Date(),
      changeFrequency: "monthly" as const,
      priority: 0.8,
    },

    // Guide
    {
      url: `${baseUrl}/docs/core/guide/migrating-from-v1`,
      lastModified: new Date(),
      changeFrequency: "monthly" as const,
      priority: 0.8,
    },

    // API Documentation
    {
      url: `${baseUrl}/docs/api/authentication`,
      lastModified: new Date(),
      changeFrequency: "monthly" as const,
      priority: 0.9,
    },
    {
      url: `${baseUrl}/docs/api/getConfig`,
      lastModified: new Date(),
      changeFrequency: "monthly" as const,
      priority: 0.7,
    },
    {
      url: `${baseUrl}/docs/api/globalSearch`,
      lastModified: new Date(),
      changeFrequency: "monthly" as const,
      priority: 0.7,
    },

    // Projects API
    {
      url: `${baseUrl}/docs/api/projects/listProjects`,
      lastModified: new Date(),
      changeFrequency: "monthly" as const,
      priority: 0.8,
    },
    {
      url: `${baseUrl}/docs/api/projects/createProject`,
      lastModified: new Date(),
      changeFrequency: "monthly" as const,
      priority: 0.7,
    },
    {
      url: `${baseUrl}/docs/api/projects/getProject`,
      lastModified: new Date(),
      changeFrequency: "monthly" as const,
      priority: 0.7,
    },
    {
      url: `${baseUrl}/docs/api/projects/updateProject`,
      lastModified: new Date(),
      changeFrequency: "monthly" as const,
      priority: 0.7,
    },
    {
      url: `${baseUrl}/docs/api/projects/deleteProject`,
      lastModified: new Date(),
      changeFrequency: "monthly" as const,
      priority: 0.7,
    },

    // Tasks API
    {
      url: `${baseUrl}/docs/api/tasks/listTasks`,
      lastModified: new Date(),
      changeFrequency: "monthly" as const,
      priority: 0.8,
    },
    {
      url: `${baseUrl}/docs/api/tasks/createTask`,
      lastModified: new Date(),
      changeFrequency: "monthly" as const,
      priority: 0.7,
    },
    {
      url: `${baseUrl}/docs/api/tasks/getTask`,
      lastModified: new Date(),
      changeFrequency: "monthly" as const,
      priority: 0.7,
    },
    {
      url: `${baseUrl}/docs/api/tasks/updateTask`,
      lastModified: new Date(),
      changeFrequency: "monthly" as const,
      priority: 0.7,
    },
    {
      url: `${baseUrl}/docs/api/tasks/deleteTask`,
      lastModified: new Date(),
      changeFrequency: "monthly" as const,
      priority: 0.7,
    },
    {
      url: `${baseUrl}/docs/api/tasks/updateTaskTitle`,
      lastModified: new Date(),
      changeFrequency: "monthly" as const,
      priority: 0.6,
    },
    {
      url: `${baseUrl}/docs/api/tasks/updateTaskDescription`,
      lastModified: new Date(),
      changeFrequency: "monthly" as const,
      priority: 0.6,
    },
    {
      url: `${baseUrl}/docs/api/tasks/updateTaskStatus`,
      lastModified: new Date(),
      changeFrequency: "monthly" as const,
      priority: 0.6,
    },
    {
      url: `${baseUrl}/docs/api/tasks/updateTaskPriority`,
      lastModified: new Date(),
      changeFrequency: "monthly" as const,
      priority: 0.6,
    },
    {
      url: `${baseUrl}/docs/api/tasks/updateTaskDueDate`,
      lastModified: new Date(),
      changeFrequency: "monthly" as const,
      priority: 0.6,
    },
    {
      url: `${baseUrl}/docs/api/tasks/updateTaskAssignee`,
      lastModified: new Date(),
      changeFrequency: "monthly" as const,
      priority: 0.6,
    },
    {
      url: `${baseUrl}/docs/api/tasks/importTasks`,
      lastModified: new Date(),
      changeFrequency: "monthly" as const,
      priority: 0.6,
    },
    {
      url: `${baseUrl}/docs/api/tasks/exportTasks`,
      lastModified: new Date(),
      changeFrequency: "monthly" as const,
      priority: 0.6,
    },
    {
      url: `${baseUrl}/docs/api/tasks/getTaskLabels`,
      lastModified: new Date(),
      changeFrequency: "monthly" as const,
      priority: 0.6,
    },
    {
      url: `${baseUrl}/docs/api/tasks/getTaskTimeEntries`,
      lastModified: new Date(),
      changeFrequency: "monthly" as const,
      priority: 0.6,
    },

    // Labels API
    {
      url: `${baseUrl}/docs/api/labels/getWorkspaceLabels`,
      lastModified: new Date(),
      changeFrequency: "monthly" as const,
      priority: 0.7,
    },
    {
      url: `${baseUrl}/docs/api/labels/getTaskLabels`,
      lastModified: new Date(),
      changeFrequency: "monthly" as const,
      priority: 0.7,
    },
    {
      url: `${baseUrl}/docs/api/labels/createLabel`,
      lastModified: new Date(),
      changeFrequency: "monthly" as const,
      priority: 0.6,
    },
    {
      url: `${baseUrl}/docs/api/labels/getLabel`,
      lastModified: new Date(),
      changeFrequency: "monthly" as const,
      priority: 0.6,
    },
    {
      url: `${baseUrl}/docs/api/labels/updateLabel`,
      lastModified: new Date(),
      changeFrequency: "monthly" as const,
      priority: 0.6,
    },
    {
      url: `${baseUrl}/docs/api/labels/deleteLabel`,
      lastModified: new Date(),
      changeFrequency: "monthly" as const,
      priority: 0.6,
    },

    // Time Entries API
    {
      url: `${baseUrl}/docs/api/time-entries/getTaskTimeEntries`,
      lastModified: new Date(),
      changeFrequency: "monthly" as const,
      priority: 0.7,
    },
    {
      url: `${baseUrl}/docs/api/time-entries/createTimeEntry`,
      lastModified: new Date(),
      changeFrequency: "monthly" as const,
      priority: 0.6,
    },
    {
      url: `${baseUrl}/docs/api/time-entries/getTimeEntry`,
      lastModified: new Date(),
      changeFrequency: "monthly" as const,
      priority: 0.6,
    },
    {
      url: `${baseUrl}/docs/api/time-entries/updateTimeEntry`,
      lastModified: new Date(),
      changeFrequency: "monthly" as const,
      priority: 0.6,
    },

    // Activities API
    {
      url: `${baseUrl}/docs/api/activities/getActivities`,
      lastModified: new Date(),
      changeFrequency: "monthly" as const,
      priority: 0.7,
    },
    {
      url: `${baseUrl}/docs/api/activities/createActivity`,
      lastModified: new Date(),
      changeFrequency: "monthly" as const,
      priority: 0.6,
    },

    // Comments API
    {
      url: `${baseUrl}/docs/api/comments/createComment`,
      lastModified: new Date(),
      changeFrequency: "monthly" as const,
      priority: 0.7,
    },
    {
      url: `${baseUrl}/docs/api/comments/updateComment`,
      lastModified: new Date(),
      changeFrequency: "monthly" as const,
      priority: 0.6,
    },
    {
      url: `${baseUrl}/docs/api/comments/deleteComment`,
      lastModified: new Date(),
      changeFrequency: "monthly" as const,
      priority: 0.6,
    },

    // Notifications API
    {
      url: `${baseUrl}/docs/api/notifications/listNotifications`,
      lastModified: new Date(),
      changeFrequency: "monthly" as const,
      priority: 0.7,
    },
    {
      url: `${baseUrl}/docs/api/notifications/createNotification`,
      lastModified: new Date(),
      changeFrequency: "monthly" as const,
      priority: 0.6,
    },
    {
      url: `${baseUrl}/docs/api/notifications/markNotificationAsRead`,
      lastModified: new Date(),
      changeFrequency: "monthly" as const,
      priority: 0.6,
    },
    {
      url: `${baseUrl}/docs/api/notifications/markAllNotificationsAsRead`,
      lastModified: new Date(),
      changeFrequency: "monthly" as const,
      priority: 0.6,
    },
    {
      url: `${baseUrl}/docs/api/notifications/clearAllNotifications`,
      lastModified: new Date(),
      changeFrequency: "monthly" as const,
      priority: 0.6,
    },

    // Invitations API
    {
      url: `${baseUrl}/docs/api/invitations/getUserPendingInvitations`,
      lastModified: new Date(),
      changeFrequency: "monthly" as const,
      priority: 0.7,
    },
    {
      url: `${baseUrl}/docs/api/invitations/getInvitationDetails`,
      lastModified: new Date(),
      changeFrequency: "monthly" as const,
      priority: 0.6,
    },

    // External Links API
    {
      url: `${baseUrl}/docs/api/external-links/getExternalLinksByTask`,
      lastModified: new Date(),
      changeFrequency: "monthly" as const,
      priority: 0.6,
    },

    // GitHub Integration API
    {
      url: `${baseUrl}/docs/api/github-integration/getGitHubAppInfo`,
      lastModified: new Date(),
      changeFrequency: "monthly" as const,
      priority: 0.7,
    },
    {
      url: `${baseUrl}/docs/api/github-integration/listGitHubRepositories`,
      lastModified: new Date(),
      changeFrequency: "monthly" as const,
      priority: 0.7,
    },
    {
      url: `${baseUrl}/docs/api/github-integration/verifyGitHubInstallation`,
      lastModified: new Date(),
      changeFrequency: "monthly" as const,
      priority: 0.7,
    },
    {
      url: `${baseUrl}/docs/api/github-integration/getGitHubIntegration`,
      lastModified: new Date(),
      changeFrequency: "monthly" as const,
      priority: 0.6,
    },
    {
      url: `${baseUrl}/docs/api/github-integration/createGitHubIntegration`,
      lastModified: new Date(),
      changeFrequency: "monthly" as const,
      priority: 0.6,
    },
    {
      url: `${baseUrl}/docs/api/github-integration/updateGitHubIntegration`,
      lastModified: new Date(),
      changeFrequency: "monthly" as const,
      priority: 0.6,
    },
    {
      url: `${baseUrl}/docs/api/github-integration/deleteGitHubIntegration`,
      lastModified: new Date(),
      changeFrequency: "monthly" as const,
      priority: 0.6,
    },
    {
      url: `${baseUrl}/docs/api/github-integration/importGitHubIssues`,
      lastModified: new Date(),
      changeFrequency: "monthly" as const,
      priority: 0.7,
    },
  ];

  return staticPages;
}
