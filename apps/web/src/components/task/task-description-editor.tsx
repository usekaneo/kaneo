import CommentEditor from "@/components/activity/comment-editor";

type TaskDescriptionEditorProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
};

export default function TaskDescriptionEditor({
  value,
  onChange,
  placeholder = "Add a description...",
}: TaskDescriptionEditorProps) {
  return (
    <CommentEditor
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className="[&_.kaneo-comment-editor-content_.ProseMirror]:min-h-[11rem] [&_.kaneo-comment-editor-content_.ProseMirror]:max-h-none [&_.kaneo-comment-editor-content_.ProseMirror]:overflow-visible [&_.kaneo-comment-editor-content_.ProseMirror]:px-0 [&_.kaneo-comment-editor-content_.ProseMirror]:pt-1 [&_.kaneo-comment-editor-content_.ProseMirror]:pb-2"
    />
  );
}
