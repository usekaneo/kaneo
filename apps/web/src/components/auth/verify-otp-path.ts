type VerifyOtpParams = {
  email: string;
  invitationId?: string;
  redirect?: string;
};

export type VerifyOtpState = { signUpName?: string };

export function buildVerifyOtpPath({
  email,
  invitationId,
  redirect,
}: VerifyOtpParams) {
  const params = new URLSearchParams({ email });
  if (invitationId) params.set("invitationId", invitationId);
  if (redirect) params.set("redirect", redirect);
  return `/auth/verify-otp?${params.toString()}`;
}

export function readSignUpName(state: unknown) {
  if (!state || typeof state !== "object" || !("signUpName" in state)) {
    return undefined;
  }
  const { signUpName } = state;
  return typeof signUpName === "string" && signUpName.trim()
    ? signUpName.trim()
    : undefined;
}
