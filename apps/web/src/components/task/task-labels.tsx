import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FormItem, FormLabel } from "@/components/ui/form";
import useCreateLabel from "@/hooks/mutations/label/use-create-label";
import useDeleteLabel from "@/hooks/mutations/label/use-delete-label";
import useGetLabelsByTask from "@/hooks/queries/label/use-get-labels-by-task";
import { cn } from "@/lib/cn";
import * as Popover from "@radix-ui/react-popover";
import { useQueryClient } from "@tanstack/react-query";
import { Check, PlusIcon, Search, Tag } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

const labelColors = [
  { value: "gray", label: "Grey", color: "#94a3b8" },
  { value: "dark-gray", label: "Dark Grey", color: "#64748b" },
  { value: "purple", label: "Purple", color: "#a855f7" },
  { value: "teal", label: "Teal", color: "#14b8a6" },
  { value: "green", label: "Green", color: "#22c55e" },
  { value: "yellow", label: "Yellow", color: "#eab308" },
  { value: "orange", label: "Orange", color: "#f97316" },
  { value: "pink", label: "Pink", color: "#ec4899" },
  { value: "red", label: "Red", color: "#ef4444" },
];

type LabelColor =
  | "gray"
  | "dark-gray"
  | "purple"
  | "teal"
  | "green"
  | "yellow"
  | "orange"
  | "pink"
  | "red";

type Label = {
  id: string;
  name: string;
  color: string;
  taskId: string;
  createdAt: string;
};

function TaskLabels({
  taskId,
  setIsSaving,
}: {
  taskId: string;
  setIsSaving: (isSaving: boolean) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const [selectedColor, setSelectedColor] = useState<LabelColor>("gray");
  const [colorPickerOpen, setColorPickerOpen] = useState(false);

  const searchInputRef = useRef<HTMLInputElement>(null);

  const queryClient = useQueryClient();
  const { mutateAsync: createLabel } = useCreateLabel();
  const { mutateAsync: deleteLabel } = useDeleteLabel();

  const { data: labels = [] } = useGetLabelsByTask(taskId);

  const [taskLabels, setTaskLabels] = useState<string[]>([]);

  useEffect(() => {
    if (labels?.length) {
      setTaskLabels(labels.map((label: Label) => label.id));
    } else {
      setTaskLabels([]);
    }
  }, [labels]);

  const filteredLabels = labels.filter((label: Label) =>
    label.name.toLowerCase().includes(searchValue.toLowerCase()),
  );

  const isCreatingNewLabel =
    searchValue &&
    !labels.some(
      (label: Label) => label.name.toLowerCase() === searchValue.toLowerCase(),
    );

  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      setTimeout(() => searchInputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && isCreatingNewLabel) {
      e.preventDefault();
      handleCreateLabel();
    } else if (e.key === "Escape") {
      if (searchValue) {
        setSearchValue("");
      } else {
        setIsOpen(false);
      }
    }
  };

  const toggleLabel = async (labelId: string) => {
    setIsSaving(true);
    try {
      const label = labels.find((l: Label) => l.id === labelId);
      if (!label) {
        throw new Error("Label not found");
      }

      if (taskLabels.includes(labelId)) {
        setTaskLabels(taskLabels.filter((id) => id !== labelId));

        await deleteLabel({ id: labelId });
        toast.success("Label removed");
      } else {
        setTaskLabels([...taskLabels, labelId]);

        await createLabel({
          name: label.name,
          color: label.color as LabelColor,
          taskId,
        });
        toast.success("Label added");
      }

      await queryClient.invalidateQueries({ queryKey: ["labels", taskId] });
    } catch (error) {
      toast.error("Failed to update labels");
      console.error(error);

      if (labels?.length) {
        setTaskLabels(labels.map((label: Label) => label.id));
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateLabel = async () => {
    if (!searchValue.trim()) return;

    setIsSaving(true);
    try {
      const newLabel = await createLabel({
        name: searchValue.trim(),
        color: selectedColor,
        taskId,
      });

      setSearchValue("");
      setSelectedColor("gray");

      await queryClient.invalidateQueries({ queryKey: ["labels", taskId] });

      if (newLabel?.id) {
        setTaskLabels((prev) => [...prev, newLabel.id]);
      }

      toast.success("Label created successfully");

      searchInputRef.current?.focus();
    } catch (error) {
      console.error("Failed to create label:", error);
      toast.error("Failed to create label");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <FormItem className="mt-2">
      <FormLabel>Labels</FormLabel>
      <div className="flex flex-wrap gap-2 mt-1">
        {labels
          .filter((label: Label) => taskLabels.includes(label.id))
          .map((label: Label) => (
            <Badge
              key={label.id}
              badgeColor={label.color as LabelColor}
              variant="outline"
              className="flex items-center gap-1 pl-3 cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              onClick={() => toggleLabel(label.id)}
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  toggleLabel(label.id);
                }
              }}
              aria-label={`Remove label ${label.name}`}
            >
              <span
                className="inline-block w-2 h-2 mr-1.5 rounded-full"
                style={{
                  backgroundColor:
                    labelColors.find((c) => c.value === label.color)?.color ||
                    "#94a3b8",
                }}
                aria-hidden="true"
              />
              {label.name}
            </Badge>
          ))}

        <Popover.Root open={isOpen} onOpenChange={setIsOpen}>
          <Popover.Trigger asChild>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-6 px-2 rounded-full"
              aria-label="Manage labels"
            >
              <Tag className="w-3 h-3 mr-1" aria-hidden="true" />
              <span className="text-xs">Labels</span>
            </Button>
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Content
              align="start"
              className="w-80 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md shadow-lg overflow-hidden z-50"
              sideOffset={5}
            >
              <div className="flex items-center p-2 border-b border-zinc-200 dark:border-zinc-800">
                <Search
                  className="w-4 h-4 text-zinc-500 dark:text-zinc-400 mr-2"
                  aria-hidden="true"
                />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchValue}
                  onChange={(e) => setSearchValue(e.target.value)}
                  onKeyDown={handleSearchKeyDown}
                  placeholder="Change or add labels..."
                  className="w-full bg-transparent border-none text-zinc-900 dark:text-zinc-200 text-sm focus:outline-none placeholder:text-zinc-500"
                  aria-label="Search labels or create new label"
                />
              </div>

              <div
                className="max-h-80 overflow-y-auto custom-scrollbar"
                aria-label="Available labels"
              >
                {filteredLabels.length > 0 ? (
                  <div className="py-1">
                    {filteredLabels.map((label: Label) => (
                      <button
                        key={label.id}
                        type="button"
                        className="w-full flex items-center px-3 py-2 text-sm text-left text-zinc-900 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                        onClick={() => toggleLabel(label.id)}
                        aria-selected={taskLabels.includes(label.id)}
                      >
                        <div className="flex-shrink-0 w-4 mr-2 text-center">
                          {taskLabels.includes(label.id) && (
                            <Check
                              className="w-4 h-4 text-zinc-500 dark:text-zinc-400"
                              aria-hidden="true"
                            />
                          )}
                        </div>
                        <span
                          className="w-3 h-3 rounded-full mr-2"
                          style={{
                            backgroundColor:
                              labelColors.find((c) => c.value === label.color)
                                ?.color || "#94a3b8",
                          }}
                          aria-hidden="true"
                        />
                        <span>{label.name}</span>
                      </button>
                    ))}
                  </div>
                ) : null}

                {isCreatingNewLabel && (
                  <div className="py-1 border-t border-zinc-200 dark:border-zinc-800">
                    <button
                      type="button"
                      className="w-full flex items-center px-3 py-2 text-sm text-left text-zinc-900 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                      onClick={handleCreateLabel}
                      aria-label={`Create new label "${searchValue}"`}
                    >
                      <div className="flex-shrink-0 w-4 mr-2 text-center">
                        <PlusIcon
                          className="w-4 h-4 text-zinc-500 dark:text-zinc-400"
                          aria-hidden="true"
                        />
                      </div>
                      <span
                        className="w-3 h-3 rounded-full mr-2"
                        style={{
                          backgroundColor:
                            labelColors.find((c) => c.value === selectedColor)
                              ?.color || "#94a3b8",
                        }}
                        aria-hidden="true"
                      />
                      <span>Create new label: "{searchValue}"</span>
                    </button>

                    <Popover.Root
                      open={colorPickerOpen}
                      onOpenChange={setColorPickerOpen}
                    >
                      <Popover.Trigger asChild>
                        <button
                          type="button"
                          className="w-full flex items-center px-3 py-2 text-sm text-left text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                          aria-label="Choose a color for label"
                        >
                          <div className="flex-shrink-0 w-4 mr-2" />
                          <span>Pick a color for label</span>
                        </button>
                      </Popover.Trigger>
                      <Popover.Portal>
                        <Popover.Content
                          align="start"
                          className="w-64 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md shadow-lg p-2 z-50"
                          sideOffset={5}
                          aria-label="Label color options"
                        >
                          <div
                            className="grid grid-cols-1 gap-1"
                            role="radiogroup"
                          >
                            {labelColors.map((color) => (
                              <button
                                key={color.value}
                                type="button"
                                className={cn(
                                  "flex items-center px-3 py-2 text-sm text-left text-zinc-900 dark:text-zinc-200 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800",
                                  selectedColor === color.value &&
                                    "bg-zinc-100 dark:bg-zinc-800",
                                )}
                                onClick={() => {
                                  setSelectedColor(color.value as LabelColor);
                                  setColorPickerOpen(false);
                                }}
                                aria-checked={selectedColor === color.value}
                                aria-label={`Choose color ${color.label}`}
                              >
                                <span
                                  className="w-3 h-3 rounded-full mr-3"
                                  style={{ backgroundColor: color.color }}
                                  aria-hidden="true"
                                />
                                <span>{color.label}</span>
                                {selectedColor === color.value && (
                                  <Check
                                    className="w-4 h-4 ml-auto text-zinc-500 dark:text-zinc-400"
                                    aria-hidden="true"
                                  />
                                )}
                              </button>
                            ))}
                          </div>
                        </Popover.Content>
                      </Popover.Portal>
                    </Popover.Root>
                  </div>
                )}
              </div>
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
      </div>
    </FormItem>
  );
}

export default TaskLabels;
