import { readAppVersion } from "../../app-version";
import { getInstanceSettings } from "../../instance-settings/get-instance-settings";
import { describeAuth } from "../system/describe-auth";
import { getServiceStatus } from "../system/get-service-status";
import { listIntegrationProviders } from "../system/list-integration-providers";

async function getSystemStatus() {
  const [services, integrations, instance] = await Promise.all([
    getServiceStatus(),
    listIntegrationProviders(3_000),
    getInstanceSettings().catch(() => undefined),
  ]);
  return {
    ...services,
    version: readAppVersion(),
    auth: describeAuth(instance),
    integrations,
  };
}

export default getSystemStatus;
