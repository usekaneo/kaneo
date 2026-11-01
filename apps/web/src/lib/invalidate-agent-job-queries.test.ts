import { QueryClient } from "@tanstack/react-query";
import { expect, it } from "vite-plus/test";
import { agentQueryKeys } from "@/hooks/queries/agent/agent-query-keys";
import { invalidateAgentJobQueries } from "./invalidate-agent-job-queries";
it("invalidates job, run, conversation, repository, and recent state in only the event workspace", async () => {
  const client = new QueryClient();
  const keys = [
    agentQueryKeys.codeJob("ws", "job"),
    agentQueryKeys.run("ws", "run"),
    agentQueryKeys.conversationRuns("ws", "conversation"),
    agentQueryKeys.recentRuns("ws"),
    agentQueryKeys.codeRepositories("ws"),
  ];
  for (const key of keys) client.setQueryData(key, {});
  const other = agentQueryKeys.run("other", "run");
  client.setQueryData(other, {});
  await invalidateAgentJobQueries(client, "ws");
  for (const key of keys)
    expect(client.getQueryState(key)?.isInvalidated).toBe(true);
  expect(client.getQueryState(other)?.isInvalidated).toBe(false);
  client.clear();
});
