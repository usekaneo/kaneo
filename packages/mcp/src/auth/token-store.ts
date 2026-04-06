import { chmod, mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";

export type StoredCredentials = {
  version: 1;
  baseUrl: string;
  clientId: string;
  accessToken: string;
};

const FILE_MODE = 0o600;
const DIR_MODE = 0o700;

function configDir(): string {
  const base =
    process.env.XDG_CONFIG_HOME?.trim() || path.join(homedir(), ".config");
  return path.join(base, "kaneo-mcp");
}

export function credentialsPath(): string {
  return path.join(configDir(), "credentials.json");
}

export async function loadCredentials(): Promise<StoredCredentials | null> {
  try {
    const raw = await readFile(credentialsPath(), "utf8");
    const parsed = JSON.parse(raw) as StoredCredentials;
    if (
      parsed?.version === 1 &&
      typeof parsed.baseUrl === "string" &&
      typeof parsed.clientId === "string" &&
      typeof parsed.accessToken === "string"
    ) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

export async function saveCredentials(data: StoredCredentials): Promise<void> {
  const dir = configDir();
  await mkdir(dir, { recursive: true, mode: DIR_MODE });
  const file = credentialsPath();
  await writeFile(file, `${JSON.stringify(data, null, 2)}\n`, {
    mode: FILE_MODE,
  });
  try {
    await chmod(file, FILE_MODE);
  } catch {
    /* ignore chmod failures on some FS */
  }
}

export async function clearCredentials(): Promise<void> {
  try {
    await unlink(credentialsPath());
  } catch {
    /* noop */
  }
}
