import { parseUserAgent, type UserAgentDevice } from "./parse-user-agent";

export type EmailRequestContext = {
  requestedAt: Date;
  device?: UserAgentDevice;
};

export function getEmailRequestContext(
  headers: Headers | null | undefined,
): EmailRequestContext {
  return {
    requestedAt: new Date(),
    device: parseUserAgent(headers?.get("user-agent")),
  };
}
