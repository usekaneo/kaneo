import { filterSuggestionItems } from "@blocknote/core";
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/shadcn";
import { useCallback, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
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
import { Form, FormControl, FormField } from "@/components/ui/form";
import { KbdSequence } from "@/components/ui/kbd";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useUpdateTaskDescription } from "@/hooks/mutations/task/use-update-task-description";
import useGetTask from "@/hooks/queries/task/use-get-task";
import { getModifierKeyText } from "@/hooks/use-keyboard-shortcuts";
import { cn } from "@/lib/cn";
import debounce from "@/lib/debounce";
import { useUserPreferencesStore } from "@/store/user-preferences";

interface TaskDescriptionProps {
  taskId: string;
}

export default function TaskDescription({ taskId }: TaskDescriptionProps) {
  const { data: task } = useGetTask(taskId);
  const { mutateAsync: updateTaskDescription } = useUpdateTaskDescription();
  const { theme } = useUserPreferencesStore();
  const isInitializedRef = useRef(false);
  const isLoadingInitialContent = useRef(false);
  const taskRef = useRef(task);
  const updateTaskRef = useRef(updateTaskDescription);

  useEffect(() => {
    taskRef.current = task;
    updateTaskRef.current = updateTaskDescription;
  }, [task, updateTaskDescription]);

  const form = useForm<{
    description: string;
  }>({
    values: {
      description: task?.description || "",
    },
  });

  const editor = useCreateBlockNote({
    initialContent: [
      {
        type: "paragraph",
        content: "",
      },
    ],
  });

  useEffect(() => {
    if (task?.description?.trim() && !isInitializedRef.current) {
      const loadMarkdown = async () => {
        isLoadingInitialContent.current = true;
        try {
          const blocks = await editor.tryParseMarkdownToBlocks(
            task.description || "",
          );
          editor.replaceBlocks(editor.document, blocks);
          setTimeout(() => {
            isInitializedRef.current = true;
            isLoadingInitialContent.current = false;
          }, 100);
        } catch {
          const blocks = await editor.tryParseMarkdownToBlocks("");
          editor.replaceBlocks(editor.document, blocks);
          setTimeout(() => {
            isInitializedRef.current = true;
            isLoadingInitialContent.current = false;
          }, 100);
        }
      };
      loadMarkdown();
    } else if (!task?.description?.trim() && !isInitializedRef.current) {
      const clearEditor = async () => {
        isLoadingInitialContent.current = true;
        const blocks = await editor.tryParseMarkdownToBlocks("");
        editor.replaceBlocks(editor.document, blocks);
        setTimeout(() => {
          isInitializedRef.current = true;
          isLoadingInitialContent.current = false;
        }, 100);
      };
      clearEditor();
    }
  }, [task?.description, editor]);

  const debouncedUpdate = useCallback(
    debounce(async (markdown: string) => {
      if (!isInitializedRef.current) return;

      const currentTask = taskRef.current;
      const updateTaskFn = updateTaskRef.current;

      if (!currentTask || !updateTaskFn) return;

      try {
        await updateTaskFn({
          ...currentTask,
          description: markdown,
        });
      } catch (error) {
        console.error("Failed to update description:", error);
      }
    }, 800),
    [],
  );

  const handleEditorChange = useCallback(async () => {
    if (!isInitializedRef.current || isLoadingInitialContent.current) {
      return;
    }

    try {
      const markdown = await editor.blocksToMarkdownLossy(editor.document);
      form.setValue("description", markdown);
      debouncedUpdate(markdown);
    } catch (error) {
      console.error("Failed to convert blocks to markdown:", error);
    }
  }, [editor, form, debouncedUpdate]);

  return (
    <Form {...form}>
      <FormField
        control={form.control}
        name="description"
        render={() => (
          <FormControl>
            <div className="blocknote-transparent">
              <BlockNoteView
                editor={editor}
                className="min-h-[200px] [&>div:first-of-type]:!pl-0 [&>div:first-of-type]:!bg-transparent"
                data-placeholder="Add a description..."
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
                                isSelected: (block) =>
                                  block.type === "paragraph",
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
                              onClick={() =>
                                editor.toggleStyles({ bold: true })
                              }
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
                              onClick={() =>
                                editor.toggleStyles({ code: true })
                              }
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
          </FormControl>
        )}
      />
    </Form>
  );
}
