import TaskItem from "@tiptap/extension-task-item";
import type { NodeViewProps } from "@tiptap/react";
import {
  NodeViewContent,
  NodeViewWrapper,
  ReactNodeViewRenderer,
} from "@tiptap/react";
import { Checkbox } from "@/components/ui/checkbox";

function TaskItemNodeView({ editor, node, updateAttributes }: NodeViewProps) {
  const checked = Boolean(node.attrs.checked);
  const isEditable = editor.isEditable;

  return (
    <NodeViewWrapper
      as="li"
      data-type="taskItem"
      data-checked={checked ? "true" : "false"}
    >
      <div contentEditable={false} className="kaneo-task-item-checkbox">
        <Checkbox
          checked={checked}
          disabled={!isEditable}
          aria-label={
            checked ? "Mark task as incomplete" : "Mark task as complete"
          }
          onCheckedChange={(value) => {
            if (!isEditable) return;
            updateAttributes({ checked: value === true });
          }}
        />
      </div>
      <NodeViewContent as="div" />
    </NodeViewWrapper>
  );
}

export const TaskItemWithCheckbox = TaskItem.extend({
  addNodeView() {
    return ReactNodeViewRenderer(TaskItemNodeView);
  },
});
