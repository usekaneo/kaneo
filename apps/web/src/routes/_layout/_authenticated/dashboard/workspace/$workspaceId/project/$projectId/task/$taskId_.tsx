import TaskLayout from "@/components/common/task-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { KbdSequence } from "@/components/ui/kbd";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import useGetProject from "@/hooks/queries/project/use-get-project";
import useGetTask from "@/hooks/queries/task/use-get-task";
import { getModifierKeyText } from "@/hooks/use-keyboard-shortcuts";
import { cn } from "@/lib/cn";
import { useUserPreferencesStore } from "@/store/user-preferences";
import {
  BlockTypeSelect,
  type BlockTypeSelectItem,
  CreateLinkButton,
  FormattingToolbarController,
  useCreateBlockNote,
} from "@blocknote/react";
import { BlockNoteView } from "@blocknote/shadcn";
import "@blocknote/shadcn/style.css";
import { createFileRoute } from "@tanstack/react-router";
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

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/workspace/$workspaceId/project/$projectId/task/$taskId_",
)({
  component: RouteComponent,
});

function RouteComponent() {
  const { projectId, workspaceId, taskId } = Route.useParams();
  const { data: task } = useGetTask(taskId);
  const { data: project } = useGetProject({ id: projectId, workspaceId });
  const editor = useCreateBlockNote({
    initialContent: [
      {
        type: "paragraph",
        content: "",
      },
    ],
  });

  const { theme } = useUserPreferencesStore();

  return (
    <TaskLayout
      taskId={taskId}
      projectId={projectId}
      workspaceId={workspaceId}
      rightSidebar={
        <div className="w-72 bg-sidebar border-l border-border flex flex-col gap-2">
          Hi
        </div>
      }
    >
      <div className="flex flex-col h-full min-h-0 max-w-3xl mx-auto px-4 py-8 gap-2">
        <p className="text-xs font-semibold text-muted-foreground">
          {project?.slug}-{task?.number}
        </p>
        <Input
          placeholder="Click to add a title"
          value={task?.title || ""}
          className="!text-2xl font-semibold !border-0 px-0 py-3 !shadow-none focus-visible:!ring-0 !bg-transparent text-zinc-900 dark:text-white placeholder:text-zinc-500 dark:placeholder:text-zinc-400 tracking-tight focus:!outline-none focus-visible:!outline-none"
        />
        <div className="blocknote-transparent">
          <BlockNoteView
            editor={editor}
            className="min-h-[200px] [&>div:first-of-type]:!pl-0 [&>div:first-of-type]:!bg-transparent"
            data-placeholder="Add a description..."
            formattingToolbar={false}
            linkToolbar={false}
            filePanel={false}
            sideMenu={false}
            tableHandles={false}
            theme={theme as "dark" | "light"}
          >
            <FormattingToolbarController
              formattingToolbar={() => (
                <TooltipProvider>
                  <div className="bg-sidebar flex items-center [&>div]:!p-4">
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

                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="secondary"
                          size="xs"
                          onClick={() => editor.toggleStyles({ bold: true })}
                          className={cn(
                            "bg-transparent shadow-none text-muted-foreground",
                            editor.getActiveStyles().bold &&
                              "font-bold text-foreground bg-accent",
                          )}
                        >
                          <Bold className="size-4" />
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
                          variant="secondary"
                          size="xs"
                          onClick={() => editor.toggleStyles({ italic: true })}
                          className={cn(
                            "bg-transparent shadow-none text-muted-foreground",
                            editor.getActiveStyles().italic &&
                              "font-bold text-foreground bg-accent",
                          )}
                        >
                          <Italic className="size-4" />
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
                          variant="secondary"
                          size="xs"
                          onClick={() =>
                            editor.toggleStyles({ underline: true })
                          }
                          className={cn(
                            "bg-transparent shadow-none text-muted-foreground",
                            editor.getActiveStyles().underline &&
                              "font-bold text-foreground bg-accent",
                          )}
                        >
                          <Underline className="size-4" />
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
                          variant="secondary"
                          size="xs"
                          onClick={() => editor.toggleStyles({ code: true })}
                          className={cn(
                            "bg-transparent shadow-none text-muted-foreground",
                            editor.getActiveStyles().code &&
                              "font-bold text-foreground bg-accent",
                          )}
                        >
                          <Code className="size-4" />
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
                          variant="secondary"
                          size="xs"
                          onClick={() => editor.toggleStyles({ strike: true })}
                          className={cn(
                            "bg-transparent shadow-none text-muted-foreground",
                            editor.getActiveStyles().strike &&
                              "font-bold text-foreground bg-accent",
                          )}
                        >
                          <Strikethrough className="size-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <KbdSequence
                          keys={[getModifierKeyText(), "Shift", "X"]}
                          description="Strikethrough"
                        />
                      </TooltipContent>
                    </Tooltip>
                    <CreateLinkButton key={"createLinkButton"} />
                  </div>
                </TooltipProvider>
              )}
            />
          </BlockNoteView>
        </div>
      </div>
    </TaskLayout>
  );
}
