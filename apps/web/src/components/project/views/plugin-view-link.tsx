import { useRouter } from "@tanstack/react-router";
import type {
  PluginViewRef,
  ProjectPluginView,
} from "@/lib/plugins/runtime/use-project-plugin-views";
import { isPlainClick } from "./is-plain-click";
import { PLUGIN_VIEW_PATH } from "./plugin-view-path";
import { scopeLinkClass } from "./scope-link-class";

type PluginViewLinkProps = {
  view: ProjectPluginView;
  workspaceId: string;
  projectId: string;
  active: boolean;
  onSelect: (view: PluginViewRef) => void;
};

export function PluginViewLink({
  view,
  workspaceId,
  projectId,
  active,
  onSelect,
}: PluginViewLinkProps) {
  const router = useRouter();
  const href = router.buildLocation({
    to: PLUGIN_VIEW_PATH,
    params: {
      workspaceId,
      projectId,
      pluginId: view.pluginId,
      viewId: view.viewId,
    },
  }).href;

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
      {view.title}
    </a>
  );
}
