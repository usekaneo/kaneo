import { HTTPException } from "hono/http-exception";
import { getInstanceSettings } from "../instance-settings/get-instance-settings";
import { getAgentConfig } from "./config";

export async function getEffectiveAgentConfig() {
  const settings = await getInstanceSettings();
  return getAgentConfig(settings.agentModels);
}

export async function requireEffectiveAgentConfig() {
  const config = await getEffectiveAgentConfig();
  if (!config)
    throw new HTTPException(503, {
      message: "Agent is not configured on this instance",
    });
  return config;
}
