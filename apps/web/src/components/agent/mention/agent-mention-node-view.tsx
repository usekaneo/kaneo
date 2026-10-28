import { NodeViewWrapper, type ReactNodeViewProps } from "@tiptap/react";
import { AgentMentionChip } from "./agent-mention-chip";

export function AgentMentionNodeView({ node }: ReactNodeViewProps) {
  return (
    <NodeViewWrapper as="span" className="inline">
      <AgentMentionChip type={node.attrs.type} label={node.attrs.label} />
    </NodeViewWrapper>
  );
}
