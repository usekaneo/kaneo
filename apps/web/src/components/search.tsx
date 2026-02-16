import { SearchIcon } from "lucide-react";
import { useState } from "react";
import { shortcuts } from "@/constants/shortcuts";
import { useRegisterShortcuts } from "@/hooks/use-keyboard-shortcuts";
import SearchCommandMenu from "./search-command-menu";
import { Input } from "./ui/input";
import { SidebarGroup } from "./ui/sidebar";

function Search() {
  const [open, setOpen] = useState(false);

  useRegisterShortcuts({
    shortcuts: {
      [shortcuts.search.prefix]: () => {
        setOpen(true);
      },
    },
  });

  return (
    <SidebarGroup className="pb-1">
      <div className="relative">
        <Input
          name="search"
          type="search"
          placeholder="Search"
          readOnly
          className="peer rounded-md border-sidebar-border/70 bg-sidebar-accent/15 ps-9 pe-9 text-sidebar-foreground placeholder:text-sidebar-foreground/60 shadow-none"
          onClick={() => setOpen(true)}
          onFocus={() => setOpen(true)}
        />
        <div className="pointer-events-none absolute inset-y-0 start-0 flex items-center justify-center ps-3 text-sidebar-foreground/65 peer-disabled:opacity-50">
          <SearchIcon aria-hidden="true" className="h-4 w-4" />
        </div>
        <button
          aria-label="Open search"
          className="absolute inset-y-0 end-0 flex h-full w-9 items-center justify-center rounded-e-md text-sidebar-foreground/70 outline-none transition-[color,box-shadow] hover:text-sidebar-foreground focus:z-10 focus-visible:ring-[3px] focus-visible:ring-ring/40"
          onClick={() => setOpen(true)}
          type="button"
        >
          <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-md bg-sidebar-accent px-1.5 text-[10px] leading-none text-sidebar-foreground/75">
            {shortcuts.search.prefix}
          </span>
        </button>
      </div>
      <SearchCommandMenu open={open} setOpen={setOpen} />
    </SidebarGroup>
  );
}

export default Search;
