import type { AnyExtension } from "@tiptap/core";
import Placeholder from "@tiptap/extension-placeholder";
import { Table } from "@tiptap/extension-table";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import TableRow from "@tiptap/extension-table-row";
import TaskItem from "@tiptap/extension-task-item";
import TaskList from "@tiptap/extension-task-list";
import { Markdown } from "@tiptap/markdown";
import StarterKit from "@tiptap/starter-kit";
import { AttachmentCard } from "./attachment-card";
import { EmbedBlock } from "./embed-block";
import { KaneoImage } from "./kaneo-image";
import { KaneoIssueLink } from "./kaneo-issue-link";
import { SafeHardBreak } from "./safe-hard-break";

export type BaseExtensionNodes = {
  attachmentCard?: AnyExtension;
  kaneoIssueLink?: AnyExtension;
  image?: AnyExtension;
  taskItem?: AnyExtension;
  embedBlock?: AnyExtension;
};

export type BaseExtensionsOptions = {
  placeholder: string;
  keymap?: AnyExtension[];
  decorations?: AnyExtension[];
  extra?: AnyExtension[];
  nodes?: BaseExtensionNodes;
  tableResizable?: boolean;
};

export function createBaseExtensions({
  placeholder,
  keymap = [],
  decorations = [],
  extra = [],
  nodes = {},
  tableResizable = true,
}: BaseExtensionsOptions): AnyExtension[] {
  const image = nodes.image ?? KaneoImage;
  const taskItem = nodes.taskItem ?? TaskItem;

  return [
    StarterKit.configure({
      codeBlock: { HTMLAttributes: { class: "kaneo-tiptap-codeblock" } },
      trailingNode: false,
      heading: { levels: [1, 2, 3] },
      hardBreak: false,
    }),
    SafeHardBreak,
    ...keymap,
    Markdown.configure({ markedOptions: { breaks: true, gfm: true } }),
    ...decorations,
    nodes.embedBlock ?? EmbedBlock,
    nodes.attachmentCard ?? AttachmentCard,
    nodes.kaneoIssueLink ?? KaneoIssueLink,
    ...extra,
    TaskList,
    image.configure({
      HTMLAttributes: { class: "kaneo-editor-image", loading: "lazy" },
    }),
    taskItem.configure({ nested: true }),
    Placeholder.configure({ placeholder }),
    Table.configure({ resizable: tableResizable }),
    TableRow,
    TableHeader,
    TableCell,
  ];
}
