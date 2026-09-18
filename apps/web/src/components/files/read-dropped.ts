export type DroppedFile = {
  file: File;
  /** Sub-folder inside the drop target, "" or "Photos/Summer/" style. */
  folder: string;
};

// Where files go when something is dragged inside the page: a file id or a
// folder path, never confused with files coming from the desktop.
export const FILE_DRAG_TYPE = "application/x-kaneo-file";
export const FOLDER_DRAG_TYPE = "application/x-kaneo-folder";

export const isDesktopDrag = (dataTransfer: DataTransfer) =>
  dataTransfer.types.includes("Files");

export const isInternalDrag = (dataTransfer: DataTransfer) =>
  dataTransfer.types.includes(FILE_DRAG_TYPE) ||
  dataTransfer.types.includes(FOLDER_DRAG_TYPE);

const readEntries = (reader: FileSystemDirectoryReader) =>
  new Promise<FileSystemEntry[]>((resolve, reject) =>
    reader.readEntries(resolve, reject),
  );

const entryFile = (entry: FileSystemFileEntry) =>
  new Promise<File>((resolve, reject) => entry.file(resolve, reject));

async function walk(
  entry: FileSystemEntry,
  folder: string,
  out: DroppedFile[],
) {
  if (entry.isFile) {
    out.push({ file: await entryFile(entry as FileSystemFileEntry), folder });
    return;
  }
  if (!entry.isDirectory) return;
  const reader = (entry as FileSystemDirectoryEntry).createReader();
  const inside = `${folder}${entry.name}/`;
  // readEntries hands back at most ~100 entries per call.
  for (;;) {
    const batch = await readEntries(reader);
    if (batch.length === 0) break;
    for (const child of batch) await walk(child, inside, out);
  }
}

/**
 * Files from a desktop drop, keeping the structure of any dropped folders.
 * Falls back to the flat file list where the entries API isn't available.
 */
export async function readDropped(dataTransfer: DataTransfer) {
  const entries = [...dataTransfer.items]
    .filter((item) => item.kind === "file")
    .map((item) => item.webkitGetAsEntry?.())
    .filter((entry): entry is FileSystemEntry => Boolean(entry));
  if (entries.length === 0) {
    return [...dataTransfer.files].map((file) => ({ file, folder: "" }));
  }
  const out: DroppedFile[] = [];
  for (const entry of entries) await walk(entry, "", out);
  return out;
}

/** Files picked with a folder input keep their relative path. */
export function fromFolderInput(files: FileList | null): DroppedFile[] {
  return [...(files ?? [])].map((file) => {
    const parts = file.webkitRelativePath.split("/").slice(0, -1);
    return { file, folder: parts.length ? `${parts.join("/")}/` : "" };
  });
}
