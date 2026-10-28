type SetupConfig = {
  disableLoginForm?: boolean;
  disablePasswordRegistration?: boolean;
  hasSmtp?: boolean;
};

/**
 * How a new account gets access, mirroring the API: a password link by email,
 * single sign-on when password sign-in or registration is off, or nothing
 * yet when email delivery isn't configured.
 */
export function getAccountSetupMode(config: SetupConfig | undefined) {
  if (config?.disableLoginForm || config?.disablePasswordRegistration) {
    return "sso" as const;
  }
  return config?.hasSmtp === false ? ("noEmail" as const) : ("email" as const);
}
