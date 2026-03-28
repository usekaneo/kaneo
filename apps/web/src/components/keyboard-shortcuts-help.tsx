import { useEffect, useMemo, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
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

function useShortcutCategories(): ShortcutCategory[] {
  const { t } = useTranslation();

  return useMemo(
    () => [
      {
        title: t("navigation:keyboardShortcuts.categories.general"),
        shortcuts: [
          {
            keys: [shortcuts.palette.prefix, shortcuts.palette.open],
            description: t(
              "navigation:keyboardShortcuts.items.openCommandPalette",
            ),
          },
          {
            keys: [shortcuts.search.prefix],
            description: t("navigation:keyboardShortcuts.items.globalSearch"),
          },
          {
            keys: [shortcuts.sidebar.prefix, shortcuts.sidebar.toggle],
            description: t("navigation:keyboardShortcuts.items.toggleSidebar"),
          },
          {
            keys: ["?"],
            description: t("navigation:keyboardShortcuts.items.showShortcuts"),
          },
          {
            keys: ["Escape"],
            description: t("navigation:keyboardShortcuts.items.closeModal"),
          },
        ],
      },
      {
        title: t("navigation:keyboardShortcuts.categories.create"),
        shortcuts: [
          {
            keys: [shortcuts.task.prefix, shortcuts.task.create],
            description: t("navigation:keyboardShortcuts.items.createTask"),
          },
          {
            keys: [shortcuts.project.prefix, shortcuts.project.create],
            description: t("navigation:keyboardShortcuts.items.createProject"),
          },
          {
            keys: [shortcuts.workspace.prefix, shortcuts.workspace.create],
            description: t(
              "navigation:keyboardShortcuts.items.createWorkspace",
            ),
          },
        ],
      },
      {
        title: t("navigation:keyboardShortcuts.categories.views"),
        shortcuts: [
          {
            keys: [shortcuts.view.prefix, shortcuts.view.board],
            description: t("navigation:keyboardShortcuts.items.boardView"),
          },
          {
            keys: [shortcuts.view.prefix, shortcuts.view.list],
            description: t("navigation:keyboardShortcuts.items.listView"),
          },
          {
            keys: [shortcuts.view.prefix, shortcuts.view.backlog],
            description: t("navigation:keyboardShortcuts.items.backlogView"),
          },
        ],
      },
      {
        title: t("navigation:keyboardShortcuts.categories.navigation"),
        shortcuts: [
          {
            keys: ["j"],
            description: t("navigation:keyboardShortcuts.items.nextTask"),
          },
          {
            keys: ["k"],
            description: t("navigation:keyboardShortcuts.items.prevTask"),
          },
          {
            keys: ["Enter"],
            description: t("navigation:keyboardShortcuts.items.openTask"),
          },
        ],
      },
      {
        title: t("navigation:keyboardShortcuts.categories.quickSelect"),
        shortcuts: [
          {
            keys: ["1", "2", "3", "..."],
            description: t(
              "navigation:keyboardShortcuts.items.quickSelectNumber",
            ),
          },
        ],
      },
    ],
    [t],
  );
}

export function KeyboardShortcutsHelp() {
  const { t } = useTranslation();
  const shortcutCategories = useShortcutCategories();
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
          <DialogTitle>{t("navigation:keyboardShortcuts.title")}</DialogTitle>
          <DialogDescription>
            {t("navigation:keyboardShortcuts.subtitle")}
          </DialogDescription>
        </DialogHeader>

        <Input
          placeholder={t("navigation:keyboardShortcuts.searchPlaceholder")}
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
                  {category.shortcuts.map((shortcut) => (
                    <div
                      key={`${category.title}-${shortcut.description}-${shortcut.keys.join("+")}`}
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
          <Trans
            i18nKey="navigation:keyboardShortcuts.footer"
            components={{
              kbd: <kbd className="px-1.5 py-0.5 rounded bg-muted" />,
            }}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
