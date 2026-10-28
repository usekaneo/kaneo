import { MarkdownRenderer } from "@/components/public-project/markdown-renderer";

type AgentProposalCommentProps = {
  body: string;
};

// The renderer's prose styles are sized for comments; shrink them to the row.
export function AgentProposalComment({ body }: AgentProposalCommentProps) {
  return (
    <div className="rounded-lg bg-muted px-2.5 py-2 text-foreground/80 [&_.ProseMirror]:min-h-0 [&_.ProseMirror]:text-xs/[18px] [&_.ProseMirror]:text-inherit [&_.ProseMirror_p]:my-0">
      <MarkdownRenderer content={body} />
    </div>
  );
}
