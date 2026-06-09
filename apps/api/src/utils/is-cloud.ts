export function isCloud(): boolean {
  return process.env.KANEO_CLOUD === "true";
}
