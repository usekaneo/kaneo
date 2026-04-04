import open from "open";
import { pollDeviceAccessToken, requestDeviceCode } from "./device-flow.js";
import {
  clearCredentials,
  loadCredentials,
  type StoredCredentials,
  saveCredentials,
} from "./token-store.js";

export type AuthServiceOptions = {
  baseUrl: string;
  clientId: string;
};

type TokenValidationResult = "valid" | "invalid" | "unknown";

export class AuthService {
  readonly baseUrl: string;
  readonly clientId: string;

  constructor(options: AuthServiceOptions) {
    this.baseUrl = options.baseUrl;
    this.clientId = options.clientId;
  }

  async clearToken(): Promise<void> {
    await clearCredentials();
  }

  private async validateAccessToken(
    token: string,
  ): Promise<TokenValidationResult> {
    try {
      const res = await fetch(`${this.baseUrl}/api/auth/get-session`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) {
        return "invalid";
      }
      if (!res.ok) {
        return "unknown";
      }
      const data = (await res.json().catch(() => null)) as {
        user?: { id?: string };
      } | null;
      return data?.user?.id ? "valid" : "unknown";
    } catch {
      return "unknown";
    }
  }

  private log(msg: string): void {
    console.error(`[kaneo-mcp] ${msg}`);
  }

  /**
   * Returns a valid access token, running the device authorization flow if needed.
   */
  async getAccessToken(): Promise<string> {
    const cached = await loadCredentials();
    if (
      cached &&
      cached.baseUrl === this.baseUrl &&
      cached.clientId === this.clientId &&
      cached.accessToken
    ) {
      const validation = await this.validateAccessToken(cached.accessToken);
      if (validation === "valid" || validation === "unknown") {
        return cached.accessToken;
      }
      await this.clearToken();
    }

    const code = await requestDeviceCode(this.baseUrl, this.clientId);
    const verifyUrl = code.verification_uri_complete || code.verification_uri;
    this.log(
      `Open ${verifyUrl} and approve this device. User code: ${code.user_code}`,
    );

    try {
      await open(verifyUrl);
    } catch {
      this.log("Could not open a browser automatically; use the URL above.");
    }

    const accessToken = await pollDeviceAccessToken(
      this.baseUrl,
      this.clientId,
      code.device_code,
      code.interval,
      { log: (m) => this.log(m) },
    );

    const toStore: StoredCredentials = {
      version: 1,
      baseUrl: this.baseUrl,
      clientId: this.clientId,
      accessToken,
    };
    await saveCredentials(toStore);
    return accessToken;
  }
}
