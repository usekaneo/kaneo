import Placeholder from "@tiptap/extension-placeholder";
import StarterKit from "@tiptap/starter-kit";
import { AgentMentionNode } from "./agent-mention-node";
import {
  type AgentMentionQuery,
  AgentMentionSuggestion,
} from "./agent-mention-suggestion";
import { AgentSubmitKeymap } from "./agent-submit-keymap";

type AgentPromptExtensionOptions = {
  placeholder: () => string;
  onMentionChange: (query: AgentMentionQuery | null) => void;
  onMentionKeyDown: (event: KeyboardEvent) => boolean;
  onSubmit: () => void;
  // Off for multi-paragraph prompts, where Enter starts a new paragraph.
  submitOnEnter?: boolean;
};

// A plain-text prompt: paragraphs, Shift+Enter line breaks, undo, and mention
// chips. No formatting or Markdown input rules, so typing `# ` or `- ` stays text.
export function createAgentPromptExtensions({
  placeholder,
  onMentionChange,
  onMentionKeyDown,
  onSubmit,
  submitOnEnter = true,
}: AgentPromptExtensionOptions) {
  return [
    StarterKit.configure({
      blockquote: false,
      bold: false,
      bulletList: false,
      code: false,
      codeBlock: false,
      dropcursor: false,
      gapcursor: false,
      heading: false,
      horizontalRule: false,
      italic: false,
      listItem: false,
      listKeymap: false,
      link: false,
      orderedList: false,
      strike: false,
      underline: false,
      trailingNode: false,
    }),
    Placeholder.configure({ placeholder: () => placeholder() }),
    AgentMentionNode,
    AgentMentionSuggestion.configure({
      onChange: onMentionChange,
      onKeyDown: onMentionKeyDown,
    }),
    ...(submitOnEnter ? [AgentSubmitKeymap.configure({ onSubmit })] : []),
  ];
}
