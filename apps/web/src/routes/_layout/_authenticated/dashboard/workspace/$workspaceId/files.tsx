import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  ArrowDown,
  ArrowUp,
  ChevronRight,
  Download,
  EllipsisIcon,
  FileArchive,
  FileAudio,
  File as FileIcon,
  FileImage,
  FileSpreadsheet,
  FileText,
  FileVideo,
  Folder,
  FolderInput,
  FolderOpen,
  FolderPlus,
  FolderUp,
  Link2,
  Link2Off,
  Pencil,
  Search,
  Trash2,
  Upload,
} from "lucide-react";
import {
  type DragEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import WorkspaceLayout from "@/components/common/workspace-layout";
import { MoveDialog, NameDialog } from "@/components/files/file-dialogs";
import {
  type DroppedFile,
  FILE_DRAG_TYPE,
  FOLDER_DRAG_TYPE,
  fromFolderInput,
  isDesktopDrag,
  isInternalDrag,
  readDropped,
} from "@/components/files/read-dropped";
import { type UploadItem, UploadQueue } from "@/components/files/upload-queue";
import PageTitle from "@/components/page-title";
import { useAuth } from "@/components/providers/auth-provider/hooks/use-auth";
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import {
  Menu,
  MenuItem,
  MenuPopup,
  MenuSeparator,
  MenuTrigger,
} from "@/components/ui/menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  filesApi,
  type WorkspaceFile,
  type WorkspaceFolder,
} from "@/fetchers/files";
import { useFileActions, useFileStorage, useFiles } from "@/hooks/files";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import { cn } from "@/lib/cn";
import { copyToClipboard } from "@/lib/copy-to-clipboard";
import { formatDateMedium } from "@/lib/format";
import { toast } from "@/lib/toast";

type FilesSearch = { folder?: string };

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/workspace/$workspaceId/files",
)({
  validateSearch: (search: Record<string, unknown>): FilesSearch => ({
    folder:
      typeof search.folder === "string" && search.folder
        ? search.folder
        : undefined,
  }),
  component: RouteComponent,
});

type SortKey = "name" | "size" | "added";
type NameDialogState =
  | { mode: "create" }
  | { mode: "renameFolder"; folder: WorkspaceFolder }
  | { mode: "renameFile"; file: WorkspaceFile };
type MoveState =
  | { kind: "file"; file: WorkspaceFile }
  | { kind: "folder"; folder: WorkspaceFolder };

// Parallel enough to keep the pipe busy without flooding a small server.
const UPLOAD_CONCURRENCY = 3;

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function iconFor(file: WorkspaceFile) {
  const { mimeType } = file;
  const ext = file.filename.split(".").pop()?.toLowerCase() ?? "";
  if (mimeType.startsWith("image/")) return FileImage;
  if (mimeType.startsWith("video/")) return FileVideo;
  if (mimeType.startsWith("audio/")) return FileAudio;
  if (["zip", "rar", "7z", "gz", "tar"].includes(ext)) return FileArchive;
  if (["csv", "xls", "xlsx", "ods"].includes(ext)) return FileSpreadsheet;
  if (mimeType.startsWith("text/") || mimeType === "application/pdf")
    return FileText;
  return FileIcon;
}

const parentOf = (path: string) => {
  const parts = path.split("/").filter(Boolean);
  return parts.length > 1 ? `${parts.slice(0, -1).join("/")}/` : "";
};

const lastSegment = (path: string) =>
  path.split("/").filter(Boolean).at(-1) ?? "";

function RouteComponent() {
  const { t } = useTranslation();
  const { workspaceId } = Route.useParams();
  const { folder = "" } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const { user } = useAuth();
  const { canUploadFiles, canManageFiles, canManageWorkspace } =
    useWorkspacePermission();
  const canUpload = Boolean(canUploadFiles());
  const canManage = Boolean(canManageFiles());
  const { data, isLoading } = useFiles(workspaceId, folder);
  const { data: storage } = useFileStorage(
    workspaceId,
    Boolean(canManageWorkspace()),
  );
  const actions = useFileActions(workspaceId);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({
    key: "name",
    desc: false,
  });
  const [desktopDrag, setDesktopDrag] = useState(false);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [queue, setQueue] = useState<UploadItem[]>([]);
  const [nameDialog, setNameDialog] = useState<NameDialogState | null>(null);
  const [moving, setMoving] = useState<MoveState | null>(null);
  const [toDelete, setToDelete] = useState<WorkspaceFile | null>(null);

  const parts: string[] = folder.split("/").filter(Boolean);
  const goTo = (path: string) => {
    setQuery("");
    navigate({ search: path ? { folder: path } : {} });
  };

  // A drag that ends outside the page never fires dragleave on our target.
  useEffect(() => {
    const reset = () => {
      setDesktopDrag(false);
      setDropTarget(null);
    };
    window.addEventListener("dragend", reset);
    window.addEventListener("drop", reset);
    return () => {
      window.removeEventListener("dragend", reset);
      window.removeEventListener("drop", reset);
    };
  }, []);

  const fail = useCallback(
    (error: unknown) =>
      toast.error(error instanceof Error ? error.message : t("files:error")),
    [t],
  );

  const patchItem = (id: string, patch: Partial<UploadItem>) =>
    setQueue((items) =>
      items.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );

  const uploadAll = async (dropped: DroppedFile[], base: string) => {
    if (!canUpload || dropped.length === 0) return;
    const jobs = dropped.map((d) => ({
      ...d,
      id: crypto.randomUUID(),
      target: `${base}${d.folder}`,
    }));
    setQueue((items) => [
      // Finished rows from an earlier batch make way for the new one.
      ...items.filter((i) => i.status === "queued" || i.status === "uploading"),
      ...jobs.map((job) => ({
        id: job.id,
        name: job.file.name,
        folder: job.target,
        progress: 0,
        status: "queued" as const,
      })),
    ]);

    let next = 0;
    const worker = async () => {
      while (next < jobs.length) {
        const job = jobs[next++];
        if (!job) return;
        patchItem(job.id, { status: "uploading" });
        try {
          await actions.upload.mutateAsync({
            file: job.file,
            folder: job.target,
            onProgress: (progress) => patchItem(job.id, { progress }),
          });
          patchItem(job.id, { status: "done", progress: 1 });
        } catch (error) {
          patchItem(job.id, {
            status: "error",
            error: error instanceof Error ? error.message : t("files:error"),
          });
        }
      }
    };
    await Promise.all(
      Array.from({ length: Math.min(UPLOAD_CONCURRENCY, jobs.length) }, worker),
    );
  };

  const copyLink = async (file: WorkspaceFile) => {
    try {
      const shared = file.publicUrl
        ? file
        : await actions.share.mutateAsync(file.id);
      if (shared.publicUrl) {
        await copyToClipboard(shared.publicUrl);
        toast.success(t("files:linkCopied"));
      }
    } catch (error) {
      fail(error);
    }
  };

  const act = (fn: () => Promise<unknown>, success?: string) =>
    fn()
      .then(() => success && toast.success(success))
      .catch(fail);

  const moveFile = (file: WorkspaceFile, to: string) => {
    if (file.folder === to) return;
    act(
      () => actions.update.mutateAsync({ id: file.id, folder: to }),
      t("files:moved", { name: file.filename }),
    );
  };

  const moveFolderInto = (from: string, parent: string) => {
    const to = `${parent}${lastSegment(from)}/`;
    if (to === from || parent.startsWith(from)) return;
    act(
      () => actions.moveFolder.mutateAsync({ from, to }),
      t("files:moved", { name: lastSegment(from) }),
    );
  };

  const canChangeFile = (file: WorkspaceFile) =>
    file.uploadedBy === user?.id || canManage;

  const allFiles = data?.files ?? [];
  const allFolders = data?.folders ?? [];

  const { files, folders } = useMemo(() => {
    const q = query.trim().toLowerCase();
    const dir = sort.desc ? -1 : 1;
    const byName = (a: string, b: string) =>
      a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
    const shownFolders = allFolders
      .filter((f) => !q || f.name.toLowerCase().includes(q))
      .sort((a, b) =>
        sort.key === "size"
          ? dir * (a.fileCount - b.fileCount)
          : dir * byName(a.name, b.name),
      );
    const shownFiles = allFiles
      .filter((f) => !q || f.filename.toLowerCase().includes(q))
      .sort((a, b) => {
        if (sort.key === "size") return dir * (a.size - b.size);
        if (sort.key === "added")
          return (
            dir *
            (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
          );
        return dir * byName(a.filename, b.filename);
      });
    return { files: shownFiles, folders: shownFolders };
  }, [allFiles, allFolders, query, sort]);

  /** Drop handlers for anything that is a folder: rows and breadcrumbs. */
  const dropProps = (path: string) => ({
    onDragOver: (e: DragEvent) => {
      const internal = isInternalDrag(e.dataTransfer);
      if (!internal && !(canUpload && isDesktopDrag(e.dataTransfer))) return;
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = internal ? "move" : "copy";
      if (!internal) setDesktopDrag(true);
      setDropTarget(path);
    },
    onDragLeave: (e: DragEvent) => {
      if (e.currentTarget.contains(e.relatedTarget as Node)) return;
      setDropTarget((current) => (current === path ? null : current));
    },
    onDrop: (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDropTarget(null);
      setDesktopDrag(false);
      const fileId = e.dataTransfer.getData(FILE_DRAG_TYPE);
      const folderPath = e.dataTransfer.getData(FOLDER_DRAG_TYPE);
      if (fileId) {
        const file = allFiles.find((f) => f.id === fileId);
        if (file) moveFile(file, path);
      } else if (folderPath) {
        moveFolderInto(folderPath, path);
      } else if (canUpload) {
        void readDropped(e.dataTransfer).then((dropped) =>
          uploadAll(dropped, path),
        );
      }
    },
  });

  const sortHeader = (key: SortKey, label: string, className?: string) => (
    <TableHead className={className}>
      <button
        type="button"
        className={cn(
          "inline-flex items-center gap-1 hover:text-foreground",
          sort.key === key && "text-foreground",
        )}
        onClick={() =>
          setSort((s) =>
            s.key === key ? { key, desc: !s.desc } : { key, desc: false },
          )
        }
      >
        {label}
        {sort.key === key &&
          (sort.desc ? (
            <ArrowDown className="size-3" />
          ) : (
            <ArrowUp className="size-3" />
          ))}
      </button>
    </TableHead>
  );

  const submitName = (value: string) => {
    if (!nameDialog) return;
    if (nameDialog.mode === "create") {
      actions.createFolder
        .mutateAsync({ parent: folder, name: value })
        .then(() => {
          toast.success(t("files:folderCreated", { name: value }));
          setNameDialog(null);
        })
        .catch(fail);
    } else if (nameDialog.mode === "renameFolder") {
      const from = nameDialog.folder.path;
      actions.moveFolder
        .mutateAsync({ from, to: `${parentOf(from)}${value}/` })
        .then(() => setNameDialog(null))
        .catch(fail);
    } else {
      actions.update
        .mutateAsync({ id: nameDialog.file.id, filename: value })
        .then(() => setNameDialog(null))
        .catch(fail);
    }
  };

  const here = parts.length ? lastSegment(folder) : t("files:allFiles");
  const dropLabel =
    dropTarget === null || dropTarget === folder
      ? here
      : lastSegment(dropTarget) || t("files:allFiles");
  const nothingHere = allFiles.length === 0 && allFolders.length === 0;
  const noMatches = !nothingHere && files.length === 0 && folders.length === 0;

  return (
    <>
      <PageTitle title={t("files:title")} />
      <WorkspaceLayout
        title={t("files:title")}
        headerActions={
          canUpload ? (
            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="xs"
                className="gap-1"
                onClick={() => setNameDialog({ mode: "create" })}
              >
                <FolderPlus className="size-3" />
                {t("files:newFolder")}
              </Button>
              <Menu>
                <MenuTrigger render={<Button size="xs" className="gap-1" />}>
                  <Upload className="size-3" />
                  {t("files:upload")}
                </MenuTrigger>
                <MenuPopup align="end">
                  <MenuItem onClick={() => fileInputRef.current?.click()}>
                    <Upload className="size-4" />
                    {t("files:uploadFiles")}
                  </MenuItem>
                  <MenuItem onClick={() => folderInputRef.current?.click()}>
                    <FolderUp className="size-4" />
                    {t("files:uploadFolder")}
                  </MenuItem>
                </MenuPopup>
              </Menu>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                hidden
                onChange={(e) => {
                  void uploadAll(
                    [...(e.target.files ?? [])].map((file) => ({
                      file,
                      folder: "",
                    })),
                    folder,
                  );
                  e.target.value = "";
                }}
              />
              <input
                ref={(el) => {
                  folderInputRef.current = el;
                  // Not in React's input types, but every browser supports it.
                  el?.setAttribute("webkitdirectory", "");
                }}
                type="file"
                hidden
                onChange={(e) => {
                  void uploadAll(fromFolderInput(e.target.files), folder);
                  e.target.value = "";
                }}
              />
            </div>
          ) : null
        }
      >
        <section
          aria-label={t("files:dropHint")}
          className="relative min-h-full space-y-4 p-4"
          onDragOver={(e) => {
            if (!canUpload || !isDesktopDrag(e.dataTransfer)) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = "copy";
            setDesktopDrag(true);
            setDropTarget(null);
          }}
          onDragLeave={(e) => {
            if (e.currentTarget.contains(e.relatedTarget as Node)) return;
            setDesktopDrag(false);
          }}
          onDrop={(e) => {
            if (!isDesktopDrag(e.dataTransfer)) return;
            e.preventDefault();
            setDesktopDrag(false);
            void readDropped(e.dataTransfer).then((dropped) =>
              uploadAll(dropped, folder),
            );
          }}
        >
          {desktopDrag && (
            <div className="pointer-events-none absolute inset-2 z-10 rounded-xl border-2 border-primary/50 border-dashed bg-primary/5">
              <div className="-translate-x-1/2 absolute bottom-6 left-1/2 flex items-center gap-2 rounded-full bg-primary px-4 py-2 font-medium text-primary-foreground text-sm shadow-lg">
                <Upload className="size-4" />
                {t("files:dropInto", { name: dropLabel })}
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2">
            <nav
              aria-label={t("files:breadcrumbs")}
              className="flex min-w-0 flex-wrap items-center gap-0.5 text-sm"
            >
              {[
                "",
                ...parts.map((_, i) => `${parts.slice(0, i + 1).join("/")}/`),
              ].map((path, index, all) => (
                <span
                  key={path || "root"}
                  className="flex items-center gap-0.5"
                >
                  {index > 0 && (
                    <ChevronRight className="size-3.5 text-muted-foreground" />
                  )}
                  <button
                    type="button"
                    {...dropProps(path)}
                    className={cn(
                      "rounded-md px-1.5 py-0.5 transition-colors hover:bg-accent",
                      index === all.length - 1
                        ? "font-medium"
                        : "text-muted-foreground",
                      dropTarget === path &&
                        "bg-primary/10 text-primary ring-1 ring-primary/40",
                    )}
                    onClick={() => goTo(path)}
                  >
                    {path ? lastSegment(path) : t("files:allFiles")}
                  </button>
                </span>
              ))}
            </nav>
            {!nothingHere && (
              <div className="relative w-full sm:w-56">
                <Search className="-translate-y-1/2 absolute top-1/2 left-2.5 size-3.5 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t("files:searchHere")}
                  aria-label={t("files:searchHere")}
                  className="h-8 ps-7 text-sm"
                />
              </div>
            )}
          </div>

          {storage && !storage.connected && (
            <p className="text-muted-foreground text-xs">
              {t("files:databaseHint")}
            </p>
          )}

          {isLoading ? null : nothingHere ? (
            <Empty className="rounded-xl border border-border border-dashed py-16">
              <EmptyHeader>
                <EmptyMedia>
                  {folder ? (
                    <FolderOpen className="size-8 text-muted-foreground" />
                  ) : (
                    <Upload className="size-8 text-muted-foreground" />
                  )}
                </EmptyMedia>
                <EmptyTitle>
                  {folder ? t("files:emptyFolder") : t("files:emptyTitle")}
                </EmptyTitle>
                <EmptyDescription>
                  {canUpload ? t("files:emptyDescription") : null}
                </EmptyDescription>
              </EmptyHeader>
              {canUpload && (
                <EmptyContent className="flex-row justify-center gap-2">
                  <Button
                    size="sm"
                    className="gap-1.5"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="size-3.5" />
                    {t("files:uploadFiles")}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5"
                    onClick={() => setNameDialog({ mode: "create" })}
                  >
                    <FolderPlus className="size-3.5" />
                    {t("files:newFolder")}
                  </Button>
                </EmptyContent>
              )}
            </Empty>
          ) : noMatches ? (
            <p className="py-10 text-center text-muted-foreground text-sm">
              {t("files:noMatches", { query })}
            </p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    {sortHeader("name", t("files:columns.name"), "ps-4")}
                    {sortHeader(
                      "size",
                      t("files:columns.size"),
                      "w-24 text-right",
                    )}
                    <TableHead className="w-40">
                      {t("files:columns.by")}
                    </TableHead>
                    {sortHeader("added", t("files:columns.added"), "w-32")}
                    <TableHead className="w-px pe-4" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {folders.map((item) => (
                    <TableRow
                      key={`folder-${item.path}`}
                      draggable={canUpload}
                      onDragStart={(e) => {
                        e.dataTransfer.setData(FOLDER_DRAG_TYPE, item.path);
                        e.dataTransfer.effectAllowed = "move";
                      }}
                      {...dropProps(item.path)}
                      className={cn(
                        "group cursor-pointer",
                        dropTarget === item.path &&
                          "bg-primary/10 outline-1 outline-primary/40 -outline-offset-1",
                      )}
                      onClick={() => goTo(item.path)}
                    >
                      <TableCell className="ps-4">
                        <span className="flex items-center gap-2 font-medium">
                          {dropTarget === item.path ? (
                            <FolderOpen className="size-4 text-primary" />
                          ) : (
                            <Folder className="size-4 fill-amber-400/30 text-amber-500" />
                          )}
                          {item.name}
                        </span>
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground text-xs">
                        {t("files:fileCount", { count: item.fileCount })}
                      </TableCell>
                      <TableCell />
                      <TableCell />
                      <TableCell
                        className="pe-4 text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {canUpload && (
                          <Menu>
                            <MenuTrigger
                              render={
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-muted-foreground"
                                  aria-label={t("files:folderActions")}
                                />
                              }
                            >
                              <EllipsisIcon className="size-4" />
                            </MenuTrigger>
                            <MenuPopup align="end">
                              <MenuItem onClick={() => goTo(item.path)}>
                                <FolderOpen className="size-4" />
                                {t("files:open")}
                              </MenuItem>
                              <MenuItem
                                onClick={() =>
                                  setNameDialog({
                                    mode: "renameFolder",
                                    folder: item,
                                  })
                                }
                              >
                                <Pencil className="size-4" />
                                {t("files:rename")}
                              </MenuItem>
                              <MenuItem
                                onClick={() =>
                                  setMoving({ kind: "folder", folder: item })
                                }
                              >
                                <FolderInput className="size-4" />
                                {t("files:moveTo")}
                              </MenuItem>
                              {item.fileCount === 0 && (
                                <>
                                  <MenuSeparator />
                                  <MenuItem
                                    variant="destructive"
                                    onClick={() =>
                                      act(
                                        () =>
                                          actions.deleteFolder.mutateAsync(
                                            item.path,
                                          ),
                                        t("files:folderDeleted"),
                                      )
                                    }
                                  >
                                    <Trash2 className="size-4" />
                                    {t("files:delete")}
                                  </MenuItem>
                                </>
                              )}
                            </MenuPopup>
                          </Menu>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {files.map((file) => {
                    const Icon = iconFor(file);
                    const canChange = canChangeFile(file);
                    return (
                      <TableRow
                        key={file.id}
                        draggable={canChange}
                        onDragStart={(e) => {
                          e.dataTransfer.setData(FILE_DRAG_TYPE, file.id);
                          e.dataTransfer.effectAllowed = "move";
                        }}
                        className={cn(
                          canChange && "cursor-grab active:cursor-grabbing",
                        )}
                      >
                        <TableCell className="ps-4">
                          <a
                            href={filesApi.downloadUrl(workspaceId, file.id)}
                            target="_blank"
                            rel="noreferrer"
                            draggable={false}
                            className="flex min-w-0 items-center gap-2 hover:underline"
                          >
                            <Icon className="size-4 shrink-0 text-muted-foreground" />
                            <span className="truncate">{file.filename}</span>
                            {file.publicUrl && (
                              <Link2
                                className="size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400"
                                aria-label={t("files:isShared")}
                              />
                            )}
                          </a>
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground tabular-nums">
                          {formatSize(file.size)}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {file.uploadedByName ?? "–"}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatDateMedium(file.createdAt)}
                        </TableCell>
                        <TableCell className="pe-4 text-right">
                          <Menu>
                            <MenuTrigger
                              render={
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-muted-foreground"
                                  aria-label={t("files:actions")}
                                />
                              }
                            >
                              <EllipsisIcon className="size-4" />
                            </MenuTrigger>
                            <MenuPopup align="end">
                              <MenuItem
                                onClick={() =>
                                  window.open(
                                    filesApi.downloadUrl(workspaceId, file.id),
                                    "_blank",
                                    "noopener",
                                  )
                                }
                              >
                                <Download className="size-4" />
                                {t("files:download")}
                              </MenuItem>
                              {(file.publicUrl || canChange) && (
                                <MenuItem onClick={() => copyLink(file)}>
                                  <Link2 className="size-4" />
                                  {file.publicUrl
                                    ? t("files:copyLink")
                                    : t("files:createLink")}
                                </MenuItem>
                              )}
                              {file.publicUrl && canChange && (
                                <MenuItem
                                  onClick={() =>
                                    act(
                                      () =>
                                        actions.unshare.mutateAsync(file.id),
                                      t("files:linkOff"),
                                    )
                                  }
                                >
                                  <Link2Off className="size-4" />
                                  {t("files:turnOffLink")}
                                </MenuItem>
                              )}
                              {canChange && (
                                <>
                                  <MenuSeparator />
                                  <MenuItem
                                    onClick={() =>
                                      setNameDialog({
                                        mode: "renameFile",
                                        file,
                                      })
                                    }
                                  >
                                    <Pencil className="size-4" />
                                    {t("files:rename")}
                                  </MenuItem>
                                  <MenuItem
                                    onClick={() =>
                                      setMoving({ kind: "file", file })
                                    }
                                  >
                                    <FolderInput className="size-4" />
                                    {t("files:moveTo")}
                                  </MenuItem>
                                  <MenuSeparator />
                                  <MenuItem
                                    variant="destructive"
                                    onClick={() => setToDelete(file)}
                                  >
                                    <Trash2 className="size-4" />
                                    {t("files:delete")}
                                  </MenuItem>
                                </>
                              )}
                            </MenuPopup>
                          </Menu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          {canUpload && !nothingHere && (
            <p className="text-center text-muted-foreground text-xs">
              {t("files:dragHint")}
            </p>
          )}
        </section>

        <NameDialog
          open={!!nameDialog}
          title={
            nameDialog?.mode === "create"
              ? t("files:newFolderIn", { name: here })
              : t("files:rename")
          }
          label={
            nameDialog?.mode === "renameFile"
              ? t("files:fileName")
              : t("files:folderName")
          }
          initial={
            nameDialog?.mode === "renameFolder"
              ? nameDialog.folder.name
              : nameDialog?.mode === "renameFile"
                ? nameDialog.file.filename
                : ""
          }
          selectBaseName={nameDialog?.mode === "renameFile"}
          submitLabel={
            nameDialog?.mode === "create"
              ? t("files:createFolder")
              : t("files:save")
          }
          pending={
            actions.createFolder.isPending ||
            actions.moveFolder.isPending ||
            actions.update.isPending
          }
          onClose={() => setNameDialog(null)}
          onSubmit={submitName}
        />

        <MoveDialog
          workspaceId={workspaceId}
          open={!!moving}
          name={
            moving?.kind === "file"
              ? moving.file.filename
              : (moving?.folder.name ?? "")
          }
          current={
            moving?.kind === "file"
              ? moving.file.folder
              : moving
                ? parentOf(moving.folder.path)
                : ""
          }
          exclude={moving?.kind === "folder" ? moving.folder.path : undefined}
          pending={actions.update.isPending || actions.moveFolder.isPending}
          onClose={() => setMoving(null)}
          onMove={(target) => {
            if (moving?.kind === "file") moveFile(moving.file, target);
            else if (moving) moveFolderInto(moving.folder.path, target);
            setMoving(null);
          }}
        />

        <UploadQueue items={queue} onDismiss={() => setQueue([])} />

        <AlertDialog
          open={!!toDelete}
          onOpenChange={(open) => !open && setToDelete(null)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t("files:deleteTitle")}</AlertDialogTitle>
              <AlertDialogDescription>
                {t("files:deleteDescription", {
                  name: toDelete?.filename ?? "",
                })}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogClose render={<Button variant="outline" size="sm" />}>
                {t("common:actions.cancel")}
              </AlertDialogClose>
              <AlertDialogClose
                render={
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => {
                      const file = toDelete;
                      if (file) {
                        act(
                          () => actions.remove.mutateAsync(file.id),
                          t("files:deleted"),
                        );
                      }
                    }}
                  />
                }
              >
                <Trash2 className="mr-2 size-4" />
                {t("files:delete")}
              </AlertDialogClose>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </WorkspaceLayout>
    </>
  );
}
