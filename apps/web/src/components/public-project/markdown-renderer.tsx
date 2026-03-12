import CommentEditor from "@/components/activity/comment-editor";

type MarkdownRendererProps = {
  content: string;
};

export function MarkdownRenderer({ content }: MarkdownRendererProps) {
  return (
    <CommentEditor
      value={content}
      readOnly
      showBubbleMenu={false}
      proseClassName="kaneo-tiptap-prose"
      contentClassName="kaneo-tiptap-content"
      className="[&_.kaneo-tiptap-content_.ProseMirror]:max-h-none [&_.kaneo-tiptap-content_.ProseMirror]:overflow-visible [&_.kaneo-tiptap-content_.ProseMirror]:px-0 [&_.kaneo-tiptap-content_.ProseMirror]:py-0"
    />
  );
}
