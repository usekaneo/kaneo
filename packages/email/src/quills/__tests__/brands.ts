/**
 * Test-only mints for the package's branded address types.
 *
 * Production code may only mint these in the app's recipient / outbound-identity
 * modules. Tests need a local cast so they can call the same senders.
 */
import type { SealedEmail } from "../recipient";
import type { SendingIdentity } from "../sender";

export function sealedTo(address: string): SealedEmail {
  return address as SealedEmail;
}

export function sendingAs(address: string): SendingIdentity {
  return address as SendingIdentity;
}
