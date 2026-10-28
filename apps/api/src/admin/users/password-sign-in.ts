import { getInstanceSettings } from "../../instance-settings/get-instance-settings";

// Read at call time so tests can stub the environment.

/** Local password sign-in is turned off entirely. */
export function isPasswordSignInDisabled() {
  return process.env.DISABLE_LOGIN_FORM === "true";
}

/**
 * Whether a new account gets a link to choose a password. When password sign-in
 * or password registration is off, accounts are created for single sign-on.
 */
export async function createsPasswordAccounts() {
  return (
    !isPasswordSignInDisabled() &&
    (await getInstanceSettings()).passwordRegistrationEnabled
  );
}
