import type { ReactNode } from "react";
import { isPlainClick } from "./is-plain-click";
import type { ProjectView } from "./project-views";
import { scopeLinkClass } from "./scope-link-class";
import { useProjectViewHref } from "./use-project-view-href";

type ProjectScopeLinkProps = {
  view: ProjectView;
  workspaceId: string;
  projectId: string;
  active: boolean;
  onSelect: (view: ProjectView) => void;
  children: ReactNode;
};

export function ProjectScopeLink({
  view,
  workspaceId,
  projectId,
  active,
  onSelect,
  children,
}: ProjectScopeLinkProps) {
  const href = useProjectViewHref(view, workspaceId, projectId);

  return (
    <a
      href={href}
      aria-current={active ? "page" : undefined}
      onClick={(event) => {
        if (!isPlainClick(event)) return;
        event.preventDefault();
        onSelect(view);
      }}
      className={scopeLinkClass(active)}
    >
      {children}
    </a>
  );
}
