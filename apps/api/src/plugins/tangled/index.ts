import type { IntegrationPlugin } from "../types";
import { validateTangledConfig } from "./config";

export const tangledPlugin: IntegrationPlugin = {
  type: "tangled",
  name: "Tangled",
  validateConfig: validateTangledConfig,
};
