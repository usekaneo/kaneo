import TaskItem from "@tiptap/extension-task-item";
import type { NodeViewProps } from "@tiptap/react";
import {
  NodeViewContent,
  NodeViewWrapper,
  ReactNodeViewRenderer,
} from "@tiptap/react";
import { useTranslation } from "react-i18next";
import { Checkbox } from "@/components/ui/checkbox";

function TaskItemNodeView({ editor, node, updateAttributes }: NodeViewProps) {
  const { t } = useTranslation();
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
            checked
              ? t("tasks:detail.editor.checkbox.markIncomplete")
              : t("tasks:detail.editor.checkbox.markComplete")
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
