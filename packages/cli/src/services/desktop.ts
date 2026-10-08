import { spawn } from "node:child_process";
import { Context, Effect, Layer } from "effect";
import { isSafeUrl } from "../render/sanitize.js";
import { CliEnvironment } from "./cli-environment.js";

export type DesktopShape = {
  readonly openUrl: (url: string) => Effect.Effect<boolean>;
  readonly copy: (text: string) => Effect.Effect<boolean>;
};

export class Desktop extends Context.Service<Desktop, DesktopShape>()(
  "kaneo/Desktop",
) {}

type Launch = {
  readonly command: string;
  readonly args: ReadonlyArray<string>;
};

function run(launch: Launch, input?: string): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      const child = spawn(launch.command, launch.args, {
        stdio: [input === undefined ? "ignore" : "pipe", "ignore", "ignore"],
        detached: input === undefined,
      });
      child.once("error", () => resolve(false));
      if (input === undefined) {
        child.unref();
        resolve(true);
        return;
      }
      child.once("close", (code) => resolve(code === 0));
      child.stdin?.end(input);
    } catch {
      resolve(false);
    }
  });
}

async function firstSuccessful(
  candidates: ReadonlyArray<Launch>,
  input: string,
): Promise<boolean> {
  for (const candidate of candidates) {
    if (await run(candidate, input)) return true;
  }
  return false;
}

export const DesktopLive = Layer.effect(
  Desktop,
  Effect.gen(function* () {
    const { env, platform } = yield* CliEnvironment;
    const remote = Boolean(env.SSH_CONNECTION || env.SSH_TTY);
    const headlessLinux =
      platform === "linux" && !env.DISPLAY && !env.WAYLAND_DISPLAY;

    const opener: Launch | undefined =
      remote || headlessLinux
        ? undefined
        : platform === "darwin"
          ? { command: "open", args: [] }
          : platform === "win32"
            ? { command: "rundll32", args: ["url.dll,FileProtocolHandler"] }
            : { command: "xdg-open", args: [] };

    const clipboards: ReadonlyArray<Launch> =
      platform === "darwin"
        ? [{ command: "pbcopy", args: [] }]
        : platform === "win32"
          ? [{ command: "clip", args: [] }]
          : [
              { command: "wl-copy", args: [] },
              { command: "xclip", args: ["-selection", "clipboard"] },
              { command: "xsel", args: ["--clipboard", "--input"] },
            ];

    return {
      openUrl: (url) =>
        opener && isSafeUrl(url)
          ? Effect.promise(() =>
              run({ command: opener.command, args: [...opener.args, url] }),
            )
          : Effect.succeed(false),
      copy: (text) =>
        remote || headlessLinux
          ? Effect.succeed(false)
          : Effect.promise(() => firstSuccessful(clipboards, text)),
    };
  }),
);
