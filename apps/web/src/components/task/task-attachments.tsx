import {
  FileArchive,
  FileAudio,
  File as FileIcon,
  FileImage,
  FileSpreadsheet,
  FileText,
  FileVideo,
  Link2,
  Paperclip,
  Plus,
  Trash2,
  Upload,
} from "lucide-react";
import { useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { filesApi } from "@/fetchers/files";
import type { TaskAttachment } from "@/fetchers/task-attachment";
import {
  useTaskAttachmentActions,
  useTaskAttachments,
} from "@/hooks/queries/task/use-task-attachments";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import { cn } from "@/lib/cn";
import { formatDateMedium } from "@/lib/format";
import { toast } from "@/lib/toast";
import TaskLinkAttachment from "./task-link-attachment";

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function iconFor(attachment: TaskAttachment) {
  if (attachment.kind === "link") return Link2;
  const mimeType = attachment.mimeType ?? "";
  const ext = attachment.title.split(".").pop()?.toLowerCase() ?? "";
  if (mimeType.startsWith("image/")) return FileImage;
  if (mimeType.startsWith("video/")) return FileVideo;
  if (mimeType.startsWith("audio/")) return FileAudio;
  if (["zip", "rar", "7z", "gz", "tar"].includes(ext)) return FileArchive;
  if (["csv", "xls", "xlsx", "ods"].includes(ext)) return FileSpreadsheet;
  if (mimeType.startsWith("text/") || mimeType === "application/pdf")
    return FileText;
  return FileIcon;
}

const isImage = (a: TaskAttachment) =>
  a.kind === "file" && (a.mimeType ?? "").startsWith("image/");

function AddAttachmentPopover({
  canUpload,
  onFiles,
  onLink,
  linkPending,
}: {
  canUpload: boolean;
  onFiles: (files: File[]) => void;
  onLink: (url: string, title?: string) => Promise<boolean>;
  linkPending: boolean;
}) {
  const { t } = useTranslation();
  const id = useId();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"upload" | "link">(
    canUpload ? "upload" : "link",
  );
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const pick = (list: FileList | null) => {
    const files = Array.from(list ?? []);
    if (files.length === 0) return;
    onFiles(files);
    setOpen(false);
  };

  const submitLink = async () => {
    if (!url.trim()) return;
    if (await onLink(url.trim(), title.trim() || undefined)) {
      setUrl("");
      setTitle("");
      setOpen(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button variant="ghost" size="sm" className="text-muted-foreground" />
        }
      >
        <Plus className="size-3.5" />
        {t("tasks:attachments.add")}
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex gap-4 border-b border-border px-3" role="tablist">
          {canUpload && (
            <TabButton
              active={tab === "upload"}
              onClick={() => setTab("upload")}
            >
              {t("tasks:attachments.upload")}
            </TabButton>
          )}
          <TabButton active={tab === "link"} onClick={() => setTab("link")}>
            {t("tasks:attachments.link")}
          </TabButton>
        </div>
        {tab === "upload" && canUpload ? (
          <div
            className="space-y-2 p-3"
            // Pasting a screenshot while the popover is open uploads it.
            onPaste={(e) => {
              const files = Array.from(e.clipboardData.files);
              if (files.length) {
                e.preventDefault();
                onFiles(files);
                setOpen(false);
              }
            }}
          >
            <input
              ref={inputRef}
              type="file"
              multiple
              className="sr-only"
              onChange={(e) => {
                pick(e.target.files);
                e.target.value = "";
              }}
            />
            <Button
              className="w-full"
              size="sm"
              onClick={() => inputRef.current?.click()}
            >
              <Upload className="size-3.5" />
              {t("tasks:attachments.uploadFile")}
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              {t("tasks:attachments.pasteHint")}
            </p>
          </div>
        ) : (
          <form
            className="space-y-2 p-3"
            onSubmit={(e) => {
              e.preventDefault();
              void submitLink();
            }}
          >
            <Input
              id={`${id}-url`}
              type="url"
              autoFocus
              value={url}
              placeholder="https://"
              aria-label={t("tasks:attachments.url")}
              onChange={(e) => setUrl(e.target.value)}
            />
            <Input
              value={title}
              maxLength={200}
              placeholder={t("tasks:attachments.linkTitle")}
              aria-label={t("tasks:attachments.linkTitle")}
              onChange={(e) => setTitle(e.target.value)}
            />
            <Button
              type="submit"
              size="sm"
              className="w-full"
              disabled={!url.trim() || linkPending}
            >
              {t("tasks:attachments.addLink")}
            </Button>
          </form>
        )}
      </PopoverContent>
    </Popover>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "-mb-px border-b-2 py-2 text-sm transition-colors",
        active
          ? "border-foreground font-medium text-foreground"
          : "border-transparent text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

export default function TaskAttachments({
  taskId,
  workspaceId,
  folder,
}: {
  taskId: string;
  workspaceId: string;
  folder: string;
}) {
  const { t } = useTranslation();
  const { data: attachments = [] } = useTaskAttachments(taskId);
  const { upload, addLink, remove } = useTaskAttachmentActions({
    taskId,
    workspaceId,
    folder,
  });
  const { canUpdateTasks, canUploadFiles } = useWorkspacePermission();
  const canEdit = canUpdateTasks();
  const canUpload = canEdit && canUploadFiles();
  const [uploading, setUploading] = useState<
    { name: string; progress: number }[]
  >([]);
  const [dragging, setDragging] = useState(false);

  const uploadFiles = async (files: File[]) => {
    setUploading((prev) => [
      ...prev,
      ...files.map((f) => ({ name: f.name, progress: 0 })),
    ]);
    for (const file of files) {
      try {
        await upload.mutateAsync({
          file,
          onProgress: (progress) =>
            setUploading((prev) =>
              prev.map((u) => (u.name === file.name ? { ...u, progress } : u)),
            ),
        });
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : t("tasks:attachments.uploadError"),
        );
      } finally {
        setUploading((prev) => prev.filter((u) => u.name !== file.name));
      }
    }
  };

  const addLinkAttachment = async (url: string, title?: string) => {
    try {
      await addLink.mutateAsync({ url, title });
      return true;
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("tasks:attachments.linkError"),
      );
      return false;
    }
  };

  const removeAttachment = (id: string) =>
    remove
      .mutateAsync(id)
      .catch((error) =>
        toast.error(
          error instanceof Error
            ? error.message
            : t("tasks:attachments.removeError"),
        ),
      );

  const images = attachments.filter(isImage);
  const others = attachments.filter((a) => !isImage(a));
  const hrefFor = (a: TaskAttachment) =>
    a.kind === "link"
      ? (a.url ?? "#")
      : filesApi.downloadUrl(workspaceId, a.fileId ?? "");

  return (
    <section
      aria-label={t("tasks:attachments.title")}
      className={cn(
        "rounded-lg border border-border bg-sidebar/30 px-4 py-3 transition-colors",
        dragging && "border-primary bg-primary/5",
      )}
      onDragOver={(e) => {
        if (!canUpload || !e.dataTransfer.types.includes("Files")) return;
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        if (!canUpload) return;
        e.preventDefault();
        setDragging(false);
        const files = Array.from(e.dataTransfer.files);
        if (files.length) void uploadFiles(files);
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Paperclip className="size-4 text-muted-foreground" />
          {t("tasks:attachments.title")}
          {attachments.length > 0 && (
            <span className="rounded bg-muted px-2 py-0.5 text-xs font-normal text-muted-foreground">
              {attachments.length}
            </span>
          )}
        </h2>
        {canEdit && (
          <AddAttachmentPopover
            canUpload={canUpload}
            onFiles={(files) => void uploadFiles(files)}
            onLink={addLinkAttachment}
            linkPending={addLink.isPending}
          />
        )}
      </div>

      {attachments.length === 0 && uploading.length === 0 && (
        <p className="mt-2 text-xs text-muted-foreground">
          {canUpload
            ? t("tasks:attachments.emptyDrop")
            : t("tasks:attachments.empty")}
        </p>
      )}

      {images.length > 0 && (
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {images.map((image) => (
            <div
              key={image.id}
              className="group relative overflow-hidden rounded-md border border-border bg-muted"
            >
              <a href={hrefFor(image)} target="_blank" rel="noreferrer">
                <img
                  src={hrefFor(image)}
                  alt={image.title}
                  loading="lazy"
                  className="aspect-video w-full object-cover transition-transform group-hover:scale-[1.02]"
                />
              </a>
              <div className="flex items-center justify-between gap-1 px-2 py-1 text-xs">
                <span className="truncate" title={image.title}>
                  {image.title}
                </span>
                {canEdit && (
                  <RemoveButton
                    label={t("tasks:attachments.remove")}
                    onClick={() => void removeAttachment(image.id)}
                  />
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {(others.length > 0 || uploading.length > 0) && (
        <ul className="mt-2 divide-y divide-border">
          {others.map((attachment) => {
            if (attachment.kind === "link") {
              return (
                <TaskLinkAttachment
                  key={attachment.id}
                  attachment={attachment}
                  workspaceId={workspaceId}
                  action={
                    canEdit ? (
                      <RemoveButton
                        label={t("tasks:attachments.remove")}
                        onClick={() => void removeAttachment(attachment.id)}
                      />
                    ) : null
                  }
                />
              );
            }
            const Icon = iconFor(attachment);
            return (
              <li
                key={attachment.id}
                className="group flex items-center gap-3 py-2 text-sm"
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted">
                  <Icon className="size-4 text-muted-foreground" />
                </span>
                <div className="min-w-0 flex-1">
                  <a
                    href={hrefFor(attachment)}
                    target="_blank"
                    rel="noreferrer"
                    className="block truncate font-medium hover:underline"
                  >
                    {attachment.title}
                  </a>
                  <p className="truncate text-xs text-muted-foreground">
                    {[
                      attachment.size !== null
                        ? formatSize(attachment.size)
                        : null,
                      attachment.createdByName,
                      formatDateMedium(attachment.createdAt),
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                {canEdit && (
                  <RemoveButton
                    label={t("tasks:attachments.remove")}
                    onClick={() => void removeAttachment(attachment.id)}
                  />
                )}
              </li>
            );
          })}
          {uploading.map((item) => (
            <li
              key={`uploading-${item.name}`}
              className="flex items-center gap-3 py-2 text-sm"
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted">
                <Upload className="size-4 animate-pulse text-muted-foreground" />
              </span>
              <div className="min-w-0 flex-1 space-y-1">
                <p className="truncate">{item.name}</p>
                <div className="h-1 overflow-hidden rounded bg-muted">
                  <div
                    className="h-full bg-primary transition-[width]"
                    style={{ width: `${Math.round(item.progress * 100)}%` }}
                  />
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function RemoveButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <Button
      variant="ghost"
      size="icon-xs"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="shrink-0 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100 focus-visible:opacity-100"
    >
      <Trash2 className="size-3.5" />
    </Button>
  );
}
