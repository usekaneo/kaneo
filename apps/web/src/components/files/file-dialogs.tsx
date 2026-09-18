import { Folder, FolderRoot, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useAllFolders } from "@/hooks/files";
import { cn } from "@/lib/cn";

export function NameDialog({
  open,
  title,
  description,
  label,
  initial,
  submitLabel,
  pending,
  selectBaseName,
  onClose,
  onSubmit,
}: {
  open: boolean;
  title: string;
  description?: string;
  label: string;
  initial: string;
  submitLabel: string;
  pending?: boolean;
  /** Select the name without its extension, like a file manager. */
  selectBaseName?: boolean;
  onClose: () => void;
  onSubmit: (value: string) => void;
}) {
  const { t } = useTranslation();
  const [value, setValue] = useState(initial);
  useEffect(() => {
    if (open) setValue(initial);
  }, [open, initial]);

  const trimmed = value.trim();
  const invalid = trimmed.includes("/") || trimmed === "." || trimmed === "..";

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogPopup className="w-full max-w-sm">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (trimmed && !invalid) onSubmit(trimmed);
          }}
        >
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            {description && (
              <DialogDescription>{description}</DialogDescription>
            )}
          </DialogHeader>
          <DialogPanel className="space-y-1.5">
            <Input
              autoFocus
              value={value}
              aria-label={label}
              placeholder={label}
              maxLength={200}
              aria-invalid={invalid || undefined}
              onFocus={(e) => {
                const dot = e.target.value.lastIndexOf(".");
                if (selectBaseName && dot > 0) {
                  e.target.setSelectionRange(0, dot);
                } else {
                  e.target.select();
                }
              }}
              onChange={(e) => setValue(e.target.value)}
            />
            {invalid && (
              <p className="text-destructive text-xs">
                {t("files:invalidName")}
              </p>
            )}
          </DialogPanel>
          <DialogFooter>
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              {t("common:actions.cancel")}
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={!trimmed || invalid || pending}
            >
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogPopup>
    </Dialog>
  );
}

export function MoveDialog({
  workspaceId,
  open,
  name,
  current,
  exclude,
  pending,
  onClose,
  onMove,
}: {
  workspaceId: string;
  open: boolean;
  name: string;
  /** Where the item is now; moving there is a no-op. */
  current: string;
  /** A folder being moved can't go into itself or below. */
  exclude?: string;
  pending?: boolean;
  onClose: () => void;
  onMove: (folder: string) => void;
}) {
  const { t } = useTranslation();
  const { data } = useAllFolders(workspaceId, open);
  const [query, setQuery] = useState("");
  const [target, setTarget] = useState(current);
  useEffect(() => {
    if (open) {
      setTarget(current);
      setQuery("");
    }
  }, [open, current]);

  const folders = useMemo(() => {
    const q = query.trim().toLowerCase();
    return ["", ...(data?.folders ?? [])].filter(
      (path) =>
        !(exclude && path.startsWith(exclude)) &&
        (!q || path.toLowerCase().includes(q)),
    );
  }, [data, exclude, query]);

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogPopup className="w-full max-w-md">
        <DialogHeader>
          <DialogTitle>{t("files:moveTitle", { name })}</DialogTitle>
        </DialogHeader>
        <DialogPanel className="space-y-2">
          <div className="relative">
            <Search className="-translate-y-1/2 absolute top-1/2 left-2.5 size-3.5 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("files:findFolder")}
              aria-label={t("files:findFolder")}
              className="ps-7"
            />
          </div>
          <div
            role="listbox"
            aria-label={t("files:moveTo")}
            className="max-h-72 overflow-y-auto rounded-lg border border-border p-1"
          >
            {folders.map((path) => {
              const depth = path.split("/").filter(Boolean).length;
              const label = path
                ? (path.split("/").filter(Boolean).at(-1) ?? path)
                : t("files:allFiles");
              const Icon = path ? Folder : FolderRoot;
              return (
                <button
                  key={path || "root"}
                  type="button"
                  role="option"
                  aria-selected={target === path}
                  onClick={() => setTarget(path)}
                  onDoubleClick={() => path !== current && onMove(path)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent",
                    target === path && "bg-accent font-medium",
                  )}
                  style={{
                    paddingInlineStart: query
                      ? undefined
                      : `${0.5 + Math.max(0, depth - 1) * 1}rem`,
                  }}
                >
                  <Icon className="size-4 shrink-0 text-muted-foreground" />
                  <span className="truncate">
                    {query && path ? path : label}
                  </span>
                  {path === current && (
                    <span className="ms-auto shrink-0 text-muted-foreground text-xs">
                      {t("files:currentFolder")}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </DialogPanel>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>
            {t("common:actions.cancel")}
          </Button>
          <Button
            size="sm"
            disabled={target === current || pending}
            onClick={() => onMove(target)}
          >
            {t("files:moveHere")}
          </Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}
