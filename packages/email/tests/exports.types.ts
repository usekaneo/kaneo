import * as entry0 from "@kaneo/email";
void entry0;
import * as entry1 from "@kaneo/email/quills";
void entry1;
import * as entry2 from "@kaneo/email/quills/templates";
void entry2;
import * as entry3 from "@kaneo/email/quills/anon";
void entry3;
import * as entry4 from "@kaneo/email/quills/message-id";
void entry4;
import * as entry5 from "@kaneo/email/quills/idempotency";
void entry5;
import * as entry6 from "@kaneo/email/quills/provider";
void entry6;
import * as entry7 from "@kaneo/email/quills/recipient";
void entry7;
import * as entry8 from "@kaneo/email/quills/sender";
void entry8;
import * as entry9 from "@kaneo/email/quills/ses";
void entry9;
import * as entry10 from "@kaneo/email/quills/ses-identity";
void entry10;
import * as entry11 from "@kaneo/email/quills/ses-tenant";
void entry11;

import {
  rawEmailInputSchema,
  sendRawEmail,
  sendMagicLinkEmail,
} from "@kaneo/email/quills";
import type { ContactEmail } from "@kaneo/email/quills/recipient";

const parsed = rawEmailInputSchema.parse({
  from: "support@example.test",
  to: "reader@example.test",
  subject: "Hello",
  html: "<p>Hello</p>",
});
function checkAuthority(contact: ContactEmail) {
  // @ts-expect-error Shape validation does not authorize a sender identity.
  void sendRawEmail(parsed);
  void sendMagicLinkEmail({
    // @ts-expect-error Contact addresses cannot receive account capabilities.
    to: contact,
    signInUrl: "https://example.test",
    code: "123456",
  });
}
void checkAuthority;
