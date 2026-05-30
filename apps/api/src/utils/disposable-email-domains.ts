// Seed list of disposable-email providers observed in the 2026-05-28 phishing
// abuse, plus a few common well-known throwaway services. These match both the
// bare domain and any subdomain (the abuse used random subdomains like
// `dwv.dropmail.me`, `xu.mimimail.me`).
//
// Keep this list lowercased. Add new providers as they show up in incidents;
// don't gold-plate it with every disposable provider in existence — the goal is
// to deter automated abuse, not to be airtight.
export const DISPOSABLE_EMAIL_DOMAINS: readonly string[] = [
  "10mail.info",
  "10mail.org",
  "10mail.xyz",
  "aadl.org",
  "canyougrab.it",
  "dropmail.me",
  "emlhub.com",
  "emlpro.com",
  "emltmp.com",
  "freeml.net",
  "gzeos.com",
  "hush2u.com",
  "mail2me.co",
  "mailpwr.com",
  "mailtowin.com",
  "maximail.vip",
  "mimimail.me",
  "passinbox.com",
  "pickmail.org",
  "pickmemail.com",
  "spymail.one",
  "yomail.info",
  // Common well-known disposable services (defense-in-depth).
  "10minutemail.com",
  "guerrillamail.com",
  "mailinator.com",
  "sharklasers.com",
  "tempmail.com",
  "tempmail.net",
  "temp-mail.org",
  "throwawaymail.com",
  "trashmail.com",
  "yopmail.com",
];
