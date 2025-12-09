import { filterSuggestionItems } from "@blocknote/core";
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/shadcn";
import { useCallback, useEffect, useState } from "react";
import "@blocknote/shadcn/style.css";
import {
  BlockTypeSelect,
  type BlockTypeSelectItem,
  CreateLinkButton,
  FormattingToolbarController,
  getDefaultReactSlashMenuItems,
  SuggestionMenuController,
} from "@blocknote/react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Bold,
  Code,
  Heading1,
  Heading2,
  Heading3,
  Italic,
  List,
  ListOrdered,
  SendHorizontal,
  Strikethrough,
  Type,
  Underline,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { KbdSequence } from "@/components/ui/kbd";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import useCreateComment from "@/hooks/mutations/comment/use-create-comment";
import { getModifierKeyText } from "@/hooks/use-keyboard-shortcuts";
import { cn } from "@/lib/cn";
import { useUserPreferencesStore } from "@/store/user-preferences";

interface CommentInputProps {
  taskId: string;
  userId: string;
}

export default function CommentInput({ taskId, userId }: CommentInputProps) {
  const { theme } = useUserPreferencesStore();
  const [content, setContent] = useState("");
  const { mutateAsync: createComment, isPending } = useCreateComment();
  const queryClient = useQueryClient();

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
      setContent(markdown.trim());
    } catch (error) {
      console.error("Failed to convert blocks to markdown:", error);
    }
  }, [editor]);

  const handleSubmit = useCallback(async () => {
    if (!content.trim()) {
      toast.error("Comment cannot be empty");
      return;
    }

    try {
      await createComment({
        taskId,
        userId,
        content,
      });

      // Clear editor
      const blocks = await editor.tryParseMarkdownToBlocks("");
      editor.replaceBlocks(editor.document, blocks);
      setContent("");

      // Invalidate activities query to refresh the list
      await queryClient.invalidateQueries({ queryKey: ["activities", taskId] });

      toast.success("Comment added");
    } catch (error) {
      console.error("Failed to create comment:", error);
      toast.error("Failed to add comment");
    }
  }, [content, createComment, taskId, userId, editor, queryClient]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        handleSubmit();
      }
    };

    const editorElement = editor.domElement;
    editorElement?.addEventListener("keydown", handleKeyDown);

    return () => {
      editorElement?.removeEventListener("keydown", handleKeyDown);
    };
  }, [editor, handleSubmit]);

  return (
    <div className="w-full">
      <div className="blocknote-transparent border border-border/50 rounded-lg bg-background/30 hover:border-border transition-colors focus-within:border-border relative pb-8">
        <BlockNoteView
          editor={editor}
          className="min-h-[42px] max-h-[300px] overflow-y-auto [&>div:first-of-type]:!pl-3 [&>div:first-of-type]:!pr-20 [&>div:first-of-type]:!py-2.5 [&>div:first-of-type]:!bg-transparent [&>div:first-of-type]:!min-h-[42px]"
          data-placeholder="Leave a comment..."
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
                <div className="bg-popover flex items-center gap-0.5 px-1.5 py-1 rounded-md border border-border shadow-lg">
                  <div className="[&_button]:h-6 [&_button]:px-2 [&_button]:text-xs [&_svg]:size-3">
                    <BlockTypeSelect
                      items={[
                        {
                          name: "Paragraph",
                          type: "paragraph",
                          icon: Type,
                          props: {},
                          isSelected: (block) => block.type === "paragraph",
                        } satisfies BlockTypeSelectItem,
                        {
                          name: "Heading 1",
                          type: "heading",
                          icon: Heading1,
                          props: {
                            level: 1,
                          },
                          isSelected: (block) =>
                            block.type === "heading" && block.props.level === 1,
                        } satisfies BlockTypeSelectItem,
                        {
                          name: "Heading 2",
                          type: "heading",
                          icon: Heading2,
                          props: {
                            level: 2,
                          },
                          isSelected: (block) =>
                            block.type === "heading" && block.props.level === 2,
                        } satisfies BlockTypeSelectItem,
                        {
                          name: "Heading 3",
                          type: "heading",
                          icon: Heading3,
                          props: {
                            level: 3,
                          },
                          isSelected: (block) =>
                            block.type === "heading" && block.props.level === 3,
                        } satisfies BlockTypeSelectItem,
                        {
                          name: "Bullet List",
                          type: "bulletListItem",
                          icon: List,
                          props: {},
                          isSelected: (block) =>
                            block.type === "bulletListItem",
                        } satisfies BlockTypeSelectItem,
                        {
                          name: "Numbered List",
                          type: "numberedListItem",
                          icon: ListOrdered,
                          props: {},
                          isSelected: (block) =>
                            block.type === "numberedListItem",
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
              filterSuggestionItems(
                getDefaultReactSlashMenuItems(editor).filter(
                  (item) => item.group !== "Media",
                ),
                query,
              )
            }
          />
        </BlockNoteView>
        <div className="absolute right-2 bottom-0 -translate-y-1/2 flex items-center gap-1">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="xs"
                  onClick={handleSubmit}
                  disabled={isPending || !content.trim()}
                  className="h-6 w-6 p-4 text-white"
                >
                  <SendHorizontal className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <KbdSequence
                  keys={[getModifierKeyText(), "Enter"]}
                  description="Submit comment"
                />
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
    </div>
  );
}
