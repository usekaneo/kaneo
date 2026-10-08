import { ArrowUpRight, Mail, Server } from "lucide-react";
import { GithubIcon } from "@/components/icons/github-icon";
import type { CommunityProject } from "@/lib/community";

const ICONS = { email: Mail, installer: Server } as const;

export function CommunityProjectCard({
  project,
}: {
  project: CommunityProject;
}) {
  const Icon = ICONS[project.kind];

  return (
    <a
      className="group flex h-full flex-col rounded-xl border bg-sidebar p-6 transition-colors focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-4 hover:border-foreground/30 md:p-8"
      href={project.href}
      rel="noreferrer"
      target="_blank"
    >
      <div className="flex items-start justify-between gap-4">
        <span className="flex size-10 items-center justify-center rounded-lg border bg-background">
          <Icon aria-hidden="true" className="size-5" />
        </span>
        <ArrowUpRight
          aria-hidden="true"
          className="size-4 text-muted-foreground transition-colors group-hover:text-foreground"
        />
      </div>

      <p className="mt-6 text-muted-foreground text-xs">{project.category}</p>
      <h3 className="mt-1.5 text-balance font-medium text-xl leading-snug transition-colors group-hover:text-primary">
        {project.name}
      </h3>
      <p className="mt-3 flex-1 text-muted-foreground leading-relaxed">
        {project.description}
      </p>

      <div className="mt-6 flex flex-wrap items-center gap-x-2.5 gap-y-1 border-t pt-5 text-muted-foreground text-xs">
        <GithubIcon className="size-3.5" />
        <span className="font-mono">{project.repo}</span>
        <span aria-hidden="true">·</span>
        <span>{project.license}</span>
      </div>
    </a>
  );
}
