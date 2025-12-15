import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/shadcn";
import { useCallback } from "react";
import "@blocknote/shadcn/style.css";
import {
  BlockTypeSelect,
  type BlockTypeSelectItem,
  CreateLinkButton,
  FormattingToolbarController,
  getDefaultReactSlashMenuItems,
  SuggestionMenuController,
} from "@blocknote/react";
import {
  Bold,
  Code,
  Heading1,
  Heading2,
  Heading3,
  Italic,
  List,
  ListOrdered,
  Strikethrough,
  Type,
  Underline,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { KbdSequence } from "@/components/ui/kbd";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { getModifierKeyText } from "@/hooks/use-keyboard-shortcuts";
import { cn } from "@/lib/cn";
import { useUserPreferencesStore } from "@/store/user-preferences";

type TaskDescriptionEditorProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
};

export default function TaskDescriptionEditor({
  value: _value,
  onChange,
  placeholder = "Add a description...",
}: TaskDescriptionEditorProps) {
  const { theme } = useUserPreferencesStore();

  const editor = useCreateBlockNote({
    initialContent: [
      {
        type: "paragraph",
        content: "",
      },
    ],
  });

  const handleEditorChange = useCallback(async () => {
    try {
      const markdown = await editor.blocksToMarkdownLossy(editor.document);
      onChange(markdown);
    } catch (error) {
      console.error("Failed to convert blocks to markdown:", error);
    }
  }, [editor, onChange]);

  return (
    <div className="blocknote-transparent h-full overflow-auto">
      <BlockNoteView
        editor={editor}
        className="h-full [&>div:first-of-type]:!pl-0 [&>div:first-of-type]:!bg-transparent [&>div:first-of-type]:!h-full"
        data-placeholder={placeholder}
        formattingToolbar={false}
        linkToolbar={false}
        filePanel={false}
        sideMenu={false}
        slashMenu={false}
        tableHandles={false}
        theme={theme as "dark" | "light"}
        onChange={handleEditorChange}
      >
        <FormattingToolbarController
          formattingToolbar={() => (
            <TooltipProvider>
              <div className="bg-sidebar flex items-center gap-0.5 px-1.5 py-1 rounded-md border border-border shadow-sm">
                <div className="[&_button]:h-6 [&_button]:px-2 [&_button]:text-xs [&_svg]:size-3">
                  <BlockTypeSelect
                    items={[
                      {
                        name: "Paragraph",
                        type: "paragraph",
                        icon: Type,
                        props: {},
                      } satisfies BlockTypeSelectItem,
                      {
                        name: "Heading 1",
                        type: "heading",
                        icon: Heading1,
                        props: {
                          level: 1,
                        },
                      } satisfies BlockTypeSelectItem,
                      {
                        name: "Heading 2",
                        type: "heading",
                        icon: Heading2,
                        props: {
                          level: 2,
                        },
                      } satisfies BlockTypeSelectItem,
                      {
                        name: "Heading 3",
                        type: "heading",
                        icon: Heading3,
                        props: {
                          level: 3,
                        },
                      } satisfies BlockTypeSelectItem,
                      {
                        name: "Bullet List",
                        type: "bulletListItem",
                        icon: List,
                        props: {},
                      } satisfies BlockTypeSelectItem,
                      {
                        name: "Numbered List",
                        type: "numberedListItem",
                        icon: ListOrdered,
                        props: {},
                      } satisfies BlockTypeSelectItem,
                    ]}
                    key={"blockTypeSelect"}
                  />
                </div>

                <div className="w-px h-4 bg-border mx-0.5" />

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="xs"
                      onClick={() => editor.toggleStyles({ bold: true })}
                      className={cn(
                        "h-6 w-6 p-0",
                        editor.getActiveStyles().bold &&
                          "bg-accent text-accent-foreground",
                      )}
                    >
                      <Bold className="size-3" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <KbdSequence
                      keys={[getModifierKeyText(), "B"]}
                      description="Bold"
                    />
                  </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="xs"
                      onClick={() => editor.toggleStyles({ italic: true })}
                      className={cn(
                        "h-6 w-6 p-0",
                        editor.getActiveStyles().italic &&
                          "bg-accent text-accent-foreground",
                      )}
                    >
                      <Italic className="size-3" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <KbdSequence
                      keys={[getModifierKeyText(), "I"]}
                      description="Italic"
                    />
                  </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="xs"
                      onClick={() => editor.toggleStyles({ underline: true })}
                      className={cn(
                        "h-6 w-6 p-0",
                        editor.getActiveStyles().underline &&
                          "bg-accent text-accent-foreground",
                      )}
                    >
                      <Underline className="size-3" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <KbdSequence
                      keys={[getModifierKeyText(), "U"]}
                      description="Underline"
                    />
                  </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="xs"
                      onClick={() => editor.toggleStyles({ code: true })}
                      className={cn(
                        "h-6 w-6 p-0",
                        editor.getActiveStyles().code &&
                          "bg-accent text-accent-foreground",
                      )}
                    >
                      <Code className="size-3" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <KbdSequence
                      keys={[getModifierKeyText(), "E"]}
                      description="Code"
                    />
                  </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="xs"
                      onClick={() => editor.toggleStyles({ strike: true })}
                      className={cn(
                        "h-6 w-6 p-0",
                        editor.getActiveStyles().strike &&
                          "bg-accent text-accent-foreground",
                      )}
                    >
                      <Strikethrough className="size-3" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <KbdSequence
                      keys={[getModifierKeyText(), "Shift", "X"]}
                      description="Strikethrough"
                    />
                  </TooltipContent>
                </Tooltip>

                <div className="w-px h-4 bg-border mx-0.5" />

                <CreateLinkButton key={"createLinkButton"} />
              </div>
            </TooltipProvider>
          )}
        />
        <SuggestionMenuController
          triggerCharacter={"/"}
          getItems={async (query) =>
            getDefaultReactSlashMenuItems(editor).filter(
              (item) => item.group !== "Media",
              query,
            )
          }
        />
      </BlockNoteView>
    </div>
  );
}
