import { digest } from "./assets.mjs";

const approved =
  "93b4ea895564c7d13a366a50e6fb6aaa4f8e14d60c7c41f28fe672d1055b712b";

export function assertApprovedMaster(bytes) {
  if (digest(bytes) !== approved)
    throw new Error(
      "Logo master differs from the user-approved artwork; review the new master before changing its approval pin",
    );
}
