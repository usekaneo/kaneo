import { chmod, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { command } from "../core.mjs";
import { sourcePath } from "./context.mjs";

export const PROBE_IMAGE =
  "node@sha256:50c8e8ca1d27439048670df5883f32d57cf81cff6233222c893fd0d9884cbd81";

export function validProbe(probe) {
  return (
    probe &&
    sourcePath(probe.module) &&
    /\.(?:mjs|js|ts)$/.test(probe.module) &&
    /^[a-zA-Z_$][\w$]{0,79}$/.test(probe.export) &&
    Array.isArray(probe.cases) &&
    probe.cases.length > 0 &&
    probe.cases.length <= 5 &&
    probe.cases.every(
      (c) => Array.isArray(c?.args) && Object.hasOwn(c, "expected"),
    ) &&
    JSON.stringify(probe).length <= 8000
  );
}

const harness = `import {readFile} from 'node:fs/promises';
import {isDeepStrictEqual} from 'node:util';
const spec=JSON.parse(await readFile('/work/probe.json','utf8'));
try {
 const module=await import('/work/subject.'+spec.extension);
 if(typeof module[spec.export]!=='function')throw new Error('Missing function');
 const results=[];
 for(const c of spec.cases){
   try{const actual=await module[spec.export](...c.args);results.push({matches:isDeepStrictEqual(actual,c.expected),actual});}
   catch(e){results.push({matches:false,error:String(e.message).slice(0,250)});}
 }
 console.log(JSON.stringify({status:'executed',results}));
}catch(e){console.log(JSON.stringify({status:'unsupported',reason:String(e.message).slice(0,250)}));}
`;

export async function probeRevision(
  snapshot,
  revision,
  probe,
  execute = command,
) {
  if (!validProbe(probe))
    return {
      status: "unsupported",
      reason: "Invalid or unsupported probe specification",
    };
  const source = await snapshot.read(probe.module, revision);
  if (
    source === null ||
    source.length > 100_000 ||
    /\b(?:import\s*(?!type\b)|require\s*\(|export[^\n]*\bfrom\b)/.test(source)
  )
    return {
      status: "unsupported",
      reason:
        "Probe runner supports standalone modules without runtime imports only",
    };
  const folder = await mkdtemp(path.join(tmpdir(), "peekareq-probe-"));
  const name = `peekareq-${path.basename(folder).toLowerCase()}`;
  try {
    await chmod(folder, 0o755);
    const extension = probe.module.split(".").at(-1);
    await writeFile(path.join(folder, `subject.${extension}`), source);
    await writeFile(
      path.join(folder, "probe.json"),
      JSON.stringify({ ...probe, extension }),
    );
    await writeFile(path.join(folder, "harness.mjs"), harness);
    await writeFile(path.join(folder, "package.json"), '{"type":"module"}');
    const output = await execute(
      "docker",
      [
        "run",
        "--rm",
        "--pull=never",
        "--name",
        name,
        "--network=none",
        "--read-only",
        "--cap-drop=ALL",
        "--security-opt=no-new-privileges",
        "--pids-limit=32",
        "--memory=128m",
        "--cpus=0.5",
        "--user=65534:65534",
        "--mount",
        `type=bind,src=${folder},dst=/work,readonly`,
        "--workdir=/work",
        PROBE_IMAGE,
        "node",
        "/work/harness.mjs",
      ],
      { timeout: 15_000, maxBuffer: 64_000 },
    );
    const result = JSON.parse(output.split("\n").at(-1));
    if (
      result.status !== "executed" ||
      !Array.isArray(result.results) ||
      result.results.length !== probe.cases.length ||
      result.results.some((r) => typeof r.matches !== "boolean")
    )
      return {
        status: "unsupported",
        reason: "Probe did not produce valid results",
      };
    return result;
  } catch {
    return {
      status: "unsupported",
      reason: "Isolated probe failed or timed out; no proof claimed",
    };
  } finally {
    await execute("docker", ["rm", "-f", name], { timeout: 10_000 }).catch(
      () => {},
    );
    await rm(folder, { recursive: true, force: true });
  }
}

export async function compareProbe(snapshot, probe) {
  const before = await probeRevision(snapshot, snapshot.base, probe);
  const after = await probeRevision(snapshot, snapshot.head, probe);
  if (before.status !== "executed" || after.status !== "executed")
    return { status: "unsupported", before, after };
  if (!before.results.every((r) => r.matches))
    return { status: "invalid-baseline", before, after };
  if (after.results.every((r) => r.matches))
    return { status: "not-reproduced", before, after };
  const repeated = await probeRevision(snapshot, snapshot.head, probe);
  if (
    repeated.status !== "executed" ||
    JSON.stringify(repeated.results) !== JSON.stringify(after.results)
  )
    return { status: "unstable", before, after, repeated };
  return { status: "reproduced", before, after, repeated };
}
