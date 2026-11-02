import { QueryClient } from "@tanstack/react-query";
import { expect, it } from "vite-plus/test";
import { agentQueryKeys } from "@/hooks/queries/agent/agent-query-keys";
import { invalidateAgentConversationRuns } from "./invalidate-agent-conversation-runs";

it("invalidates only the matching history when another session adds a run", async () => {
  const client = new QueryClient();
  const key = agentQueryKeys.conversationRuns("workspace", "conversation");
  const other = agentQueryKeys.conversationRuns("workspace", "other");
  const history = { pages: [[{ id: "old" }]], pageParams: [0] };
  client.setQueryData(key, history);
  client.setQueryData(other, history);
  await invalidateAgentConversationRuns(
    client,
    "workspace",
    "conversation",
    "new",
  );
  expect(client.getQueryState(key)?.isInvalidated).toBe(true);
  expect(client.getQueryState(other)?.isInvalidated).toBe(false);
  client.clear();
});

it("does not refetch all history pages for every streamed update to a known run", async () => {
  const client = new QueryClient();
  const key = agentQueryKeys.conversationRuns("workspace", "conversation");
  client.setQueryData(key, { pages: [[{ id: "known" }]], pageParams: [0] });
  await invalidateAgentConversationRuns(
    client,
    "workspace",
    "conversation",
    "known",
  );
  expect(client.getQueryState(key)?.isInvalidated).toBe(false);
  client.clear();
});
