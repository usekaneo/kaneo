import { filterSuggestionItems } from "@blocknote/core";
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/shadcn";
import { useCallback, useEffect, useRef, useState } from "react";
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
import { formatDistanceToNow } from "date-fns";
import {
  Bold,
  Check,
  Code,
  Heading1,
  Heading2,
  Heading3,
  Italic,
  List,
  ListOrdered,
  Pencil,
  Strikethrough,
  Type,
  Underline,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/components/providers/auth-provider/hooks/use-auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { KbdSequence } from "@/components/ui/kbd";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import useUpdateComment from "@/hooks/mutations/comment/use-update-comment";
import { getModifierKeyText } from "@/hooks/use-keyboard-shortcuts";
import { cn } from "@/lib/cn";
import { useUserPreferencesStore } from "@/store/user-preferences";

type CommentCardProps = {
  commentId: string;
  taskId: string;
  content: string;
  user: {
    id?: string;
    name?: string | null;
    email?: string | null;
    image?: string | null;
  } | null;
  createdAt: string;
};

export default function CommentCard({
  commentId,
  taskId,
  content,
  user,
  createdAt,
}: CommentCardProps) {
  const { theme } = useUserPreferencesStore();
  const { user: currentUser } = useAuth();
  const isInitializedRef = useRef(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState("");
  const { mutateAsync: updateComment, isPending } = useUpdateComment();
  const queryClient = useQueryClient();

  const editor = useCreateBlockNote({
    initialContent: [
      {
        type: "paragraph",
        content: "",
      },
    ],
  });

  const canEdit = currentUser?.id === user?.id;

  useEffect(() => {
    if (content?.trim() && !isInitializedRef.current) {
      const loadMarkdown = async () => {
        try {
          const blocks = await editor.tryParseMarkdownToBlocks(
            content.trim() || "",
          );
          editor.replaceBlocks(editor.document, blocks);
          setTimeout(() => {
            editor.isEditable = isEditing;
            isInitializedRef.current = true;
          }, 50);
        } catch (error) {
          console.error("Failed to parse markdown:", error);
          const blocks = await editor.tryParseMarkdownToBlocks("");
          editor.replaceBlocks(editor.document, blocks);
          setTimeout(() => {
            editor.isEditable = isEditing;
            isInitializedRef.current = true;
          }, 50);
        }
      };
      loadMarkdown();
    } else if (!content?.trim() && !isInitializedRef.current) {
      editor.isEditable = isEditing;
      isInitializedRef.current = true;
    }
  }, [content, editor, isEditing]);

  useEffect(() => {
    if (isEditing) {
      editor.isEditable = true;
      editor.focus();
    } else {
      editor.isEditable = false;
    }
  }, [isEditing, editor]);

  const handleEditorChange = useCallback(async () => {
    try {
      const markdown = await editor.blocksToMarkdownLossy(editor.document);
      setEditedContent(markdown.trim());
    } catch (error) {
      console.error("Failed to convert blocks to markdown:", error);
    }
  }, [editor]);

  const handleEdit = () => {
    setIsEditing(true);
    setEditedContent(content);
  };

  const handleCancel = useCallback(async () => {
    setIsEditing(false);
    // Restore original content
    try {
      const blocks = await editor.tryParseMarkdownToBlocks(
        content.trim() || "",
      );
      editor.replaceBlocks(editor.document, blocks);
      setEditedContent("");
    } catch (error) {
      console.error("Failed to restore content:", error);
    }
  }, [editor, content]);

  const handleSave = useCallback(async () => {
    if (!editedContent.trim()) {
      toast.error("Comment cannot be empty");
      return;
    }

    if (!currentUser?.id) {
      toast.error("You must be logged in to edit comments");
      return;
    }

    try {
      await updateComment({
        activityId: commentId,
        comment: editedContent,
      });

      setIsEditing(false);
      setEditedContent("");

      // Invalidate activities query to refresh the list
      await queryClient.invalidateQueries({ queryKey: ["activities", taskId] });

      toast.success("Comment updated");
    } catch (error) {
      console.error("Failed to update comment:", error);
      toast.error("Failed to update comment");
    }
  }, [
    editedContent,
    updateComment,
    commentId,
    queryClient,
    taskId,
    currentUser?.id,
  ]);

  useEffect(() => {
    if (!isEditing) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        handleSave();
      } else if (e.key === "Escape") {
        e.preventDefault();
        handleCancel();
      }
    };

    const editorElement = editor.domElement;
    editorElement?.addEventListener("keydown", handleKeyDown);

    return () => {
      editorElement?.removeEventListener("keydown", handleKeyDown);
    };
  }, [editor, isEditing, handleSave, handleCancel]);

  return (
    <div className="w-full group">
      <div className="flex items-center gap-2 mb-2">
        <HoverCard>
          <HoverCardTrigger asChild>
            <div className="flex items-center gap-2 cursor-pointer">
              <Avatar className="h-6 w-6">
                <AvatarImage src={user?.image ?? ""} alt={user?.name || ""} />
                <AvatarFallback className="text-xs font-medium bg-muted">
                  {user?.name?.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="text-sm font-medium text-foreground hover:text-primary transition-colors">
                {user?.name}
              </span>
            </div>
          </HoverCardTrigger>
          <HoverCardContent className="w-52 p-3">
            <div className="flex items-center gap-3">
              <Avatar className="h-8 w-8">
                <AvatarImage src={user?.image ?? ""} alt={user?.name || ""} />
                <AvatarFallback className="text-xs font-medium bg-muted">
                  {user?.name?.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground leading-none">
                  {user?.name}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {user?.email}
                </p>
              </div>
            </div>
          </HoverCardContent>
        </HoverCard>
        <span className="text-xs text-muted-foreground/60">
          {formatDistanceToNow(createdAt, { addSuffix: true })}
        </span>
        {canEdit && !isEditing && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleEdit}
                  className="h-6 w-6 p-0 ml-auto opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Pencil className="size-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs">Edit comment</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
      <div className="group border border-border rounded-lg bg-card/50 backdrop-blur-sm relative">
        <div
          className={cn(
            "blocknote-transparent p-4",
            !isEditing &&
              "[&_.bn-editor]:!cursor-default [&_.ProseMirror]:!outline-none [&_.ProseMirror]:!min-h-0",
          )}
        >
          <BlockNoteView
            editor={editor}
            className={cn(
              "[&>div:first-of-type]:!bg-transparent",
              isEditing
                ? "[&>div:first-of-type]:!pl-3 [&>div:first-of-type]:!pr-3 min-h-[42px] max-h-[300px] overflow-y-auto"
                : "[&>div:first-of-type]:!pl-0 [&_.bn-block-content]:!cursor-default [&>div:first-of-type]:!min-h-0",
            )}
            formattingToolbar={!isEditing ? false : undefined}
            linkToolbar={!isEditing ? false : undefined}
            filePanel={false}
            sideMenu={false}
            slashMenu={false}
            tableHandles={false}
            theme={theme as "dark" | "light"}
            onChange={isEditing ? handleEditorChange : undefined}
            editable={isEditing}
          >
            {isEditing && (
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
                                block.type === "heading" &&
                                block.props.level === 1,
                            } satisfies BlockTypeSelectItem,
                            {
                              name: "Heading 2",
                              type: "heading",
                              icon: Heading2,
                              props: {
                                level: 2,
                              },
                              isSelected: (block) =>
                                block.type === "heading" &&
                                block.props.level === 2,
                            } satisfies BlockTypeSelectItem,
                            {
                              name: "Heading 3",
                              type: "heading",
                              icon: Heading3,
                              props: {
                                level: 3,
                              },
                              isSelected: (block) =>
                                block.type === "heading" &&
                                block.props.level === 3,
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
                            onClick={() =>
                              editor.toggleStyles({ italic: true })
                            }
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
                            onClick={() =>
                              editor.toggleStyles({ underline: true })
                            }
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
                            onClick={() =>
                              editor.toggleStyles({ strike: true })
                            }
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
            )}
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
        </div>
        {isEditing && (
          <div className="flex items-center gap-1 px-4 pb-3">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleSave}
                    disabled={isPending || !editedContent.trim()}
                    className="h-7 px-3 hover:bg-accent"
                  >
                    <Check className="size-3 mr-1" />
                    Save
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <KbdSequence
                    keys={[getModifierKeyText(), "Enter"]}
                    description="Save changes"
                  />
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCancel}
                    disabled={isPending}
                    className="h-7 px-3 hover:bg-accent"
                  >
                    <X className="size-3 mr-1" />
                    Cancel
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <KbdSequence keys={["Esc"]} description="Cancel editing" />
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        )}
      </div>
    </div>
  );
}
