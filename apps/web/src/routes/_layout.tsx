import { createFileRoute, Outlet } from "@tanstack/react-router";
import { useState } from "react";
import CommandPalette from "@/components/command-palette";
import { PluginsProvider } from "@/components/plugins/plugins-provider";
import SearchCommandMenu from "@/components/search-command-menu";
import useActiveWorkspace from "@/hooks/queries/workspace/use-active-workspace";

// layout for the main app
export const Route = createFileRoute("/_layout")({
  component: RouteComponent,
});

function RouteComponent() {
  const [searchOpen, setSearchOpen] = useState(false);
  const { data: workspace } = useActiveWorkspace();
  return (
    <PluginsProvider workspaceId={workspace?.id}>
      <Outlet />
      <CommandPalette />
      <SearchCommandMenu open={searchOpen} setOpen={setSearchOpen} />
    </PluginsProvider>
  );
}
