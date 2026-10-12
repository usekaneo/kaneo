import type { ComponentType, SVGProps } from "react";
import { GiteaIcon } from "@/components/icons/gitea-icon";
import { GithubIcon } from "@/components/icons/github-icon";
import { GitlabIcon } from "@/components/icons/gitlab-icon";

export type RepositoryProviderId = "github" | "gitea" | "gitlab";

export type RepositoryProvider = {
  id: RepositoryProviderId;
  name: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  iconClassName: string;
};

export const REPOSITORY_PROVIDERS: RepositoryProvider[] = [
  {
    id: "github",
    name: "GitHub",
    icon: GithubIcon,
    iconClassName: "text-foreground",
  },
  {
    id: "gitea",
    name: "Gitea",
    icon: GiteaIcon,
    iconClassName: "text-[#609926]",
  },
  {
    id: "gitlab",
    name: "GitLab",
    icon: GitlabIcon,
    iconClassName: "text-[#FC6D26]",
  },
];
