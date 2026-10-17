import { i18n } from "./i18n";
import { ApiError, DEVICE_CLIENT_ID, httpMessage, request } from "./api/client";
import { api } from "./api/endpoints";
import type {
  CurrentUser,
  DeviceCodeResponse,
  DeviceTokenResponse,
  InstanceConfig,
} from "./api/types";
import { sessionStore, type CredentialType } from "./session";

export type DevicePoll =
  | { kind: "approved"; token: string }
  | { kind: "pending" }
  | { kind: "slowDown" }
  | { kind: "denied" }
  | { kind: "expired" };

/** Confirms the address points at a Kaneo instance and returns its sign-in options. */
export async function probe(serverUrl: string): Promise<InstanceConfig> {
  try {
    const config = await request<InstanceConfig>("api/config", { serverUrl });
    if (!config || typeof config !== "object")
      throw new ApiError(i18n.t("mobile:errors.notKaneo", { url: serverUrl }));
    return config;
  } catch (e) {
    if (e instanceof ApiError && e.status)
      throw new ApiError(
        i18n.t("mobile:errors.noInstance", {
          url: serverUrl,
          status: e.status,
        }),
      );
    throw e;
  }
}

async function tokenFrom(response: Response): Promise<string> {
  const text = await response.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (!response.ok)
    throw new ApiError(
      httpMessage(response.status, body),
      response.status,
      body,
    );
  const header = response.headers.get("set-auth-token");
  const token = header ?? (body as { token?: string } | null)?.token;
  if (!token) throw new ApiError(i18n.t("mobile:errors.noSession"));
  return token;
}

async function postRaw(
  serverUrl: string,
  path: string,
  body: unknown,
): Promise<Response> {
  return request<Response>(path, {
    serverUrl,
    method: "POST",
    body,
    raw: true,
  });
}

export async function signInWithPassword(
  serverUrl: string,
  email: string,
  password: string,
) {
  const response = await postRaw(serverUrl, "api/auth/sign-in/email", {
    email: email.trim(),
    password,
    rememberMe: true,
  });
  await completeWithToken(serverUrl, await tokenFrom(response));
}

export async function signUp(
  serverUrl: string,
  name: string,
  email: string,
  password: string,
) {
  const response = await postRaw(serverUrl, "api/auth/sign-up/email", {
    name: name.trim(),
    email: email.trim(),
    password,
  });
  await completeWithToken(serverUrl, await tokenFrom(response));
}

export async function sendOtp(serverUrl: string, email: string) {
  await request("api/auth/email-otp/send-verification-otp", {
    serverUrl,
    method: "POST",
    body: { email: email.trim(), type: "sign-in" },
  });
}

export async function signInWithOtp(
  serverUrl: string,
  email: string,
  otp: string,
) {
  const response = await postRaw(serverUrl, "api/auth/sign-in/email-otp", {
    email: email.trim(),
    otp: otp.trim(),
  });
  await completeWithToken(serverUrl, await tokenFrom(response));
}

export function startDeviceLogin(
  serverUrl: string,
): Promise<DeviceCodeResponse> {
  return request<DeviceCodeResponse>("api/auth/device/code", {
    serverUrl,
    method: "POST",
    body: { client_id: DEVICE_CLIENT_ID },
  });
}

export async function pollDeviceLogin(
  serverUrl: string,
  deviceCode: string,
): Promise<DevicePoll> {
  const response = await postRaw(serverUrl, "api/auth/device/token", {
    grant_type: "urn:ietf:params:oauth:grant-type:device_code",
    device_code: deviceCode,
    client_id: DEVICE_CLIENT_ID,
  });
  let body: DeviceTokenResponse | null = null;
  try {
    body = (await response.json()) as DeviceTokenResponse;
  } catch {
    body = null;
  }
  if (body?.access_token) return { kind: "approved", token: body.access_token };
  switch (body?.error) {
    case "authorization_pending":
      return { kind: "pending" };
    case "slow_down":
      return { kind: "slowDown" };
    case "access_denied":
      return { kind: "denied" };
    case "expired_token":
      return { kind: "expired" };
    default:
      throw new ApiError(
        body?.error_description ??
          body?.error ??
          i18n.t("mobile:errors.deviceFailed", { status: response.status }),
        response.status,
      );
  }
}

export async function completeWithToken(
  serverUrl: string,
  token: string,
  type: CredentialType = "bearer",
) {
  let user: CurrentUser;
  try {
    user = await request<CurrentUser>("api/user/me", {
      serverUrl,
      credentials: { credentialType: type, token },
    });
  } catch (e) {
    if (e instanceof ApiError && (e.status === 401 || e.status === 403)) {
      throw new ApiError(
        type === "apiKey"
          ? i18n.t("mobile:errors.apiKeyRejected")
          : i18n.t("mobile:errors.signInRejected"),
        e.status,
      );
    }
    throw e;
  }
  await sessionStore.save({
    serverUrl,
    credentialType: type,
    token,
    userId: user.id,
    userName: user.name,
    userEmail: user.email,
  });
}

export async function signOut() {
  const session = sessionStore.get().session;
  if (session?.credentialType === "bearer") {
    try {
      await api.signOut();
    } catch {
      // Signing out locally matters more than telling the server.
    }
  }
  await sessionStore.clear();
}
