import { Bot } from "lucide-react";
import { ClaudeIcon } from "@/components/icons/claude-icon";
import { GeminiIcon } from "@/components/icons/gemini-icon";
import { OpenAIIcon } from "@/components/icons/openai-icon";
import { cn } from "@/lib/cn";
import { getModelProvider } from "./get-model-provider";

const logos = {
  anthropic: ClaudeIcon,
  openai: OpenAIIcon,
  google: GeminiIcon,
  other: Bot,
};

export function AgentModelLogo({
  modelId,
  className,
}: {
  modelId: string;
  className?: string;
}) {
  const provider = getModelProvider(modelId);
  const Logo = logos[provider];
  return (
    <Logo
      aria-hidden="true"
      data-provider={provider}
      className={cn("size-3.5 shrink-0", className)}
    />
  );
}
