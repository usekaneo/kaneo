import { claimSchema, type JobSpec } from "./protocol.js";
import { git } from "./git.js";
import { prepareChangeCollector } from "./prepare-change-collector.js";
import { runOpencode } from "./opencode.js";

export type JobOptions = {
  apiUrl: string;
  audience?: string;
  jobId: string;
  cwd: string;
  modelKey: string;
  oidcUrl: string;
  oidcToken: string;
  repository: string;
};
type Dependencies = {
  fetch: typeof fetch;
  runAgent: (
    cwd: string,
    spec: JobSpec,
    key: string,
    signal: AbortSignal,
  ) => Promise<void>;
  mask: (value: string) => void;
};

export async function runJob(
  options: JobOptions,
  dependencies: Partial<Dependencies> = {},
) {
  const http = dependencies.fetch ?? fetch;
  const runAgent = dependencies.runAgent ?? runOpencode;
  const mask = dependencies.mask ?? (() => {});
  const root = new URL(options.apiUrl);
  if (
    root.protocol !== "https:" &&
    root.hostname !== "localhost" &&
    root.hostname !== "127.0.0.1"
  )
    throw new Error("HTTPS API URL required");
  root.pathname = `${root.pathname.replace(/\/$/, "").replace(/\/api$/, "")}/api/agent-jobs/`;
  root.search = "";
  root.hash = "";
  const oidcUrl = new URL(options.oidcUrl);
  // The OIDC URL comes only from Actions' trusted environment, not a job spec.
  oidcUrl.searchParams.set("audience", options.audience ?? options.apiUrl);
  const identityResponse = await http(oidcUrl, {
    headers: { Authorization: `Bearer ${options.oidcToken}` },
    signal: AbortSignal.timeout(10000),
    redirect: "error",
  });
  if (!identityResponse.ok) throw new Error("OIDC unavailable");
  const identity = (await identityResponse.json()) as { value: string };
  if (typeof identity.value !== "string") throw new Error("OIDC unavailable");
  let claim: Response | undefined;
  // GitHub can start the workflow before dispatch's response reaches Kaneo.
  for (let attempt = 0; attempt < 60; attempt++) {
    claim = await http(new URL("claim", root), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${identity.value}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ jobId: options.jobId }),
      signal: AbortSignal.timeout(10000),
      redirect: "error",
    });
    if (claim.status !== 409) break;
    await claim.body?.cancel();
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  if (!claim?.ok) throw new Error("Job claim rejected");
  const { credential, spec } = claimSchema.parse(await claim.json());
  mask(credential);
  mask(options.modelKey);
  if (
    spec.jobId !== options.jobId ||
    spec.repository.toLowerCase() !== options.repository.toLowerCase()
  )
    throw new Error("Repository identity mismatch");
  const remaining = Date.parse(spec.deadline) - Date.now();
  const controller = new AbortController();
  const signal = AbortSignal.any([
    controller.signal,
    AbortSignal.timeout(Math.max(1, Math.min(remaining, 120 * 60000))),
  ]);
  const callback = async (path: string, data: unknown) => {
    const response = await http(
      new URL(`${encodeURIComponent(spec.jobId)}/${path}`, root),
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${credential}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
        signal: AbortSignal.timeout(15000),
        redirect: "error",
      },
    );
    if (!response.ok) throw new Error("Job callback rejected");
    return response;
  };
  let pending: Promise<unknown> | undefined;
  let collector: Awaited<ReturnType<typeof prepareChangeCollector>> | undefined;
  const timer = setInterval(() => {
    if (pending) return;
    pending = callback("heartbeat", { phase: "working" })
      .catch(() => controller.abort())
      .finally(() => {
        pending = undefined;
      });
  }, 30000);
  try {
    if (!options.modelKey) {
      await callback("fail", { code: "no_model_key" });
      throw new Error("Model key required");
    }
    if (remaining <= 0) throw new Error("Job deadline reached");
    const clean = await git(options.cwd, ["status", "--porcelain"]);
    if (clean.length) throw new Error("Clean checkout required");
    await git(options.cwd, ["checkout", "--detach", spec.baseSha]);
    collector = await prepareChangeCollector(options.cwd, spec.baseSha);
    await callback("heartbeat", { phase: "working" });
    await runAgent(options.cwd, spec, options.modelKey, signal);
    signal.throwIfAborted();
    await callback("heartbeat", { phase: "collecting" });
    const files = await collector.collect();
    signal.throwIfAborted();
    const changes = files.length
      ? {
          outcome: "changes",
          baseSha: spec.baseSha,
          files,
          title: "Implement task",
          body: "",
          commitMessage: "Implement task",
          summary: `Edited ${files.length} files`,
        }
      : { outcome: "no_changes", summary: "No changes" };
    clearInterval(timer);
    await pending;
    for (const file of files) {
      if (file.action !== "upsert") continue;
      const bytes = Buffer.from(file.content, "base64");
      if (
        [options.modelKey, options.oidcToken, credential, identity.value].some(
          (secret) => secret && bytes.includes(Buffer.from(secret)),
        )
      )
        throw new Error("Secret in changeset");
    }
    await callback("changeset", changes);
  } catch {
    const timedOut = signal.aborted;
    controller.abort();
    await callback("fail", {
      code: timedOut ? "timed_out" : "agent_failed",
    }).catch(() => {});
    throw new Error("Kaneo coding job failed");
  } finally {
    clearInterval(timer);
    controller.abort();
    await pending;
    await collector?.dispose();
  }
}
