import {
  CopyIcon,
  FileTextIcon,
  GitBranchIcon,
  HashIcon,
  LinkIcon,
  type LucideIcon,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import useGetGiteaIntegration from "@/hooks/queries/gitea-integration/use-get-gitea-integration";
import useGetGithubIntegration from "@/hooks/queries/github-integration/use-get-github-integration";
import useGetGitlabIntegration from "@/hooks/queries/gitlab-integration/use-get-gitlab-integration";
import useGetProject from "@/hooks/queries/project/use-get-project";
import useGetProjects from "@/hooks/queries/project/use-get-projects";
import useGetTask from "@/hooks/queries/task/use-get-task";
import useActiveWorkspace from "@/hooks/queries/workspace/use-active-workspace";
import { generateLink } from "@/lib/generate-link";
import { getTaskPath } from "@/lib/task-link";
import { toast } from "@/lib/toast";
import { generateBranchName } from "./branch-name";

type TaskCopyActionsOptions = {
  taskId: string;
  projectId: string;
  workspaceId: string;
};

export function useTaskCopyActions({
  taskId,
  projectId,
  workspaceId,
}: TaskCopyActionsOptions) {
  const { t } = useTranslation();
  const { data: task } = useGetTask(taskId);
  const { data: project } = useGetProject({ id: projectId, workspaceId });
  const { data: workspace } = useActiveWorkspace();
  const { data: workspaceProjects = [] } = useGetProjects({ workspaceId });
  const { data: github } = useGetGithubIntegration(projectId);
  const { data: gitea } = useGetGiteaIntegration(projectId);
  const { data: gitlab } = useGetGitlabIntegration(projectId);

  const copy = async (text: string, message: string, icon: LucideIcon) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      toast.message(message, { icon });
    } catch {
      toast.error(t("tasks:shortcuts.copyFailed"));
    }
  };

  return {
    copyId: () => {
      if (!project?.slug || !task?.number) return;
      void copy(
        `${project.slug}-${task.number}`,
        t("tasks:shortcuts.idCopied"),
        HashIcon,
      );
    },
    copyTitle: () => {
      if (!task) return;
      void copy(task.title, t("tasks:shortcuts.titleCopied"), CopyIcon);
    },
    copyMarkdown: () => {
      if (!task) return;
      const markdown = [`# ${task.title}`, task.description?.trim()]
        .filter(Boolean)
        .join("\n\n");
      void copy(markdown, t("tasks:shortcuts.markdownCopied"), FileTextIcon);
    },
    copyLink: () => {
      if (!task) return;
      const path = getTaskPath({
        workspaceId,
        workspace,
        projectId,
        workspaceProjects,
        taskId,
        taskNumber: task.number,
        title: task.title,
      });
      void copy(
        generateLink(path),
        t("tasks:properties.taskLinkCopied"),
        LinkIcon,
      );
    },
    copyBranch: () => {
      const pattern =
        github?.branchPattern || gitea?.branchPattern || gitlab?.branchPattern;
      void copy(
        generateBranchName(pattern, project?.slug, task?.number, task?.title),
        t("tasks:properties.taskBranchCopied"),
        GitBranchIcon,
      );
    },
  };
}
