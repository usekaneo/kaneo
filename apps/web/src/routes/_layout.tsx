import CommandPalette from "@/components/command-palette";
import SearchCommandMenu from "@/components/search-command-menu";
import { Outlet, createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

// layout for the main app
export const Route = createFileRoute("/_layout")({
  component: RouteComponent,
});

function RouteComponent() {
  const [searchOpen, setSearchOpen] = useState(false);
  return (
    <>
      <Outlet />
      <CommandPalette />
      <SearchCommandMenu open={searchOpen} setOpen={setSearchOpen} />
    </>
  );
}
