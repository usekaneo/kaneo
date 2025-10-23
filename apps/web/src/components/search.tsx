import { SearchIcon } from "lucide-react";
import { useState } from "react";
import { shortcuts } from "@/constants/shortcuts";
import { useRegisterShortcuts } from "@/hooks/use-keyboard-shortcuts";
import SearchCommandMenu from "./search-command-menu";
import { Input } from "./ui/input";
import { Kbd } from "./ui/kbd";
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
    <SidebarGroup className="pb-0">
      <div className="relative">
        <Input
          name="search"
          type="text"
          placeholder="Search"
          className="peer shadow-none block w-full rounded-sm py-1 pl-8 pr-10 text-sm h-8 cursor-pointer focus:outline-none focus:ring-0 focus-visible:ring-0 focus-visible:border-ring-0 focus-visible:outline-none"
          onClick={() => setOpen(true)}
          readOnly
          tabIndex={-1}
        />
        <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Kbd className="absolute right-2 top-1/2 -translate-y-1/2 h-4 text-[9px] bg-muted">
          {shortcuts.search.prefix}
        </Kbd>
      </div>
      <SearchCommandMenu open={open} setOpen={setOpen} />
    </SidebarGroup>
  );
}

export default Search;
