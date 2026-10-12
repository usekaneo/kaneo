export type AccessVerificationResult = {
  isInstalled: boolean;
  hasRequiredPermissions: boolean;
  failureReason?: string | null;
  message: string;
};

export function isAccessVerified(result: AccessVerificationResult | undefined) {
  return Boolean(result?.isInstalled && result.hasRequiredPermissions);
}

export function accessVerificationTone(result: AccessVerificationResult) {
  if (isAccessVerified(result)) return "success" as const;
  return result.failureReason ? ("destructive" as const) : ("warning" as const);
}
