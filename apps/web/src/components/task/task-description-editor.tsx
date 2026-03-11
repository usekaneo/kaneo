import CommentEditor from "@/components/activity/comment-editor";

type TaskDescriptionEditorProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  taskId?: string;
  ensureTaskId?: () => Promise<string | null>;
};

export default function TaskDescriptionEditor({
  value,
  onChange,
  placeholder = "Add a description...",
  taskId,
  ensureTaskId,
}: TaskDescriptionEditorProps) {
  return (
    <CommentEditor
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      taskId={taskId}
      ensureTaskId={ensureTaskId}
      uploadSurface="description"
      className="[&_.kaneo-comment-editor-content_.ProseMirror]:min-h-[11rem] [&_.kaneo-comment-editor-content_.ProseMirror]:max-h-none [&_.kaneo-comment-editor-content_.ProseMirror]:overflow-visible [&_.kaneo-comment-editor-content_.ProseMirror]:px-0 [&_.kaneo-comment-editor-content_.ProseMirror]:pt-1 [&_.kaneo-comment-editor-content_.ProseMirror]:pb-2"
    />
  );
}
