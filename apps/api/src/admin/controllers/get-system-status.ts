import { readAppVersion } from "../../app-version";
import { describeAuth } from "../system/describe-auth";
import { getServiceStatus } from "../system/get-service-status";
import { listIntegrationProviders } from "../system/list-integration-providers";

async function getSystemStatus() {
  const [services, integrations] = await Promise.all([
    getServiceStatus(),
    listIntegrationProviders(3_000),
  ]);
  return {
    ...services,
    version: readAppVersion(),
    auth: describeAuth(),
    integrations,
  };
}

export default getSystemStatus;
