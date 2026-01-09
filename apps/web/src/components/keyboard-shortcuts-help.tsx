import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { KbdSequence } from "@/components/ui/kbd";
import { shortcuts } from "@/constants/shortcuts";

type ShortcutItem = {
  keys: string[];
  description: string;
  icon?: React.ReactNode;
};

type ShortcutCategory = {
  title: string;
  shortcuts: ShortcutItem[];
};

const shortcutCategories: ShortcutCategory[] = [
  {
    title: "General",
    shortcuts: [
      {
        keys: [shortcuts.palette.prefix, shortcuts.palette.open],
        description: "Open command palette",
      },
      {
        keys: [shortcuts.search.prefix],
        description: "Global search",
      },
      {
        keys: [shortcuts.sidebar.prefix, shortcuts.sidebar.toggle],
        description: "Toggle sidebar",
      },
      {
        keys: ["?"],
        description: "Show keyboard shortcuts",
      },
      {
        keys: ["Escape"],
        description: "Close modal/popover",
      },
    ],
  },
  {
    title: "Create",
    shortcuts: [
      {
        keys: [shortcuts.task.prefix, shortcuts.task.create],
        description: "Create task",
      },
      {
        keys: [shortcuts.project.prefix, shortcuts.project.create],
        description: "Create project",
      },
      {
        keys: [shortcuts.workspace.prefix, shortcuts.workspace.create],
        description: "Create workspace",
      },
    ],
  },
  {
    title: "Views",
    shortcuts: [
      {
        keys: [shortcuts.view.prefix, shortcuts.view.board],
        description: "Switch to board view",
      },
      {
        keys: [shortcuts.view.prefix, shortcuts.view.list],
        description: "Switch to list view",
      },
      {
        keys: [shortcuts.view.prefix, shortcuts.view.backlog],
        description: "Switch to backlog view",
      },
    ],
  },
  {
    title: "Navigation",
    shortcuts: [
      {
        keys: ["j"],
        description: "Next task",
      },
      {
        keys: ["k"],
        description: "Previous task",
      },
      {
        keys: ["Enter"],
        description: "Open selected task",
      },
    ],
  },
  {
    title: "Quick Select (in popovers)",
    shortcuts: [
      {
        keys: ["1", "2", "3", "..."],
        description: "Select option by number",
      },
    ],
  },
];

export function KeyboardShortcutsHelp() {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isTyping =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.contentEditable === "true";

      if (e.key === "?" && !isTyping) {
        e.preventDefault();
        setOpen(true);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  const filteredCategories = shortcutCategories
    .map((category) => ({
      ...category,
      shortcuts: category.shortcuts.filter(
        (shortcut) =>
          shortcut.description
            .toLowerCase()
            .includes(searchQuery.toLowerCase()) ||
          shortcut.keys.some((key) =>
            key.toLowerCase().includes(searchQuery.toLowerCase()),
          ),
      ),
    }))
    .filter((category) => category.shortcuts.length > 0);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="px-4 max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Keyboard Shortcuts</DialogTitle>
          <DialogDescription>
            Speed up your workflow with keyboard shortcuts
          </DialogDescription>
        </DialogHeader>

        <Input
          placeholder="Search shortcuts..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="mb-4"
        />

        <div className="overflow-y-auto flex-1">
          <div className="space-y-4">
            {filteredCategories.map((category) => (
              <div key={category.title}>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  {category.title}
                </h3>
                <div className="space-y-1">
                  {category.shortcuts.map((shortcut, index) => (
                    <div
                      key={`${category.title}-${index}`}
                      className="flex items-center justify-between py-1.5 px-2 rounded-md hover:bg-muted/50"
                    >
                      <span className="text-xs">{shortcut.description}</span>
                      <KbdSequence keys={shortcut.keys} />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4 pt-4 border-t text-xs text-muted-foreground mb-4">
          Press <kbd className="px-1.5 py-0.5 rounded bg-muted">Escape</kbd> to
          close
        </div>
      </DialogContent>
    </Dialog>
  );
}
