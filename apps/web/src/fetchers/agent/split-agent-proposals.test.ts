import { expect, it } from "vite-plus/test";
import type { AgentRunResponse } from "@/types/agent";
import { splitAgentProposals } from "./split-agent-proposals";
it("retains coding proposals separately without feeding them to task proposal renderers", () => {
  const task = {
    id: "task",
    action: { type: "task.update", taskId: "t", patch: { priority: "high" } },
  };
  const code = {
    id: "code",
    action: {
      type: "code.run",
      taskId: "t",
      integrationId: "i",
      instructions: "Fix",
    },
  };
  const run = {
    id: "run",
    jobs: [],
    proposals: [task, code],
  } as unknown as AgentRunResponse;
  expect(splitAgentProposals(run)).toMatchObject({
    proposals: [task],
    codeProposals: [code],
    jobs: [],
  });
  expect(run.proposals).toHaveLength(2);
});
