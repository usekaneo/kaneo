import { sql, type SQL, type SQLWrapper } from "drizzle-orm";

/*
 * Test data is identity-only. A row is test exactly when its author is a test
 * customer: a principal whose `test_owner_principal_id` is set. Only the server
 * writes that column, when it creates a teammate's test customer, so nothing a
 * client sends (custom attributes, widget metadata) can make a row test or
 * hide a real one. A teammate's own visitor ingress is real.
 */

/** Every test customer's id, evaluated once per query (an InitPlan over a partial index). */
const testCustomerIds = sql`array(select test_identity.id from quills."principal" test_identity where test_identity.test_owner_principal_id is not null)`;

/** True when the principal is a test customer. Null-safe, so it also works as a projection. */
export function isTestPrincipalSql(principalId: SQLWrapper): SQL {
  return sql`coalesce(${principalId} = any(${testCustomerIds}), false)`;
}

/** A correlated probe also handles nullable attribution and table aliases. */
export function notTestPrincipal(principalId: SQLWrapper): SQL {
  return sql`not exists (select 1 from quills."principal" test_identity where test_identity.id = ${principalId} and test_identity.test_owner_principal_id is not null)`;
}

/** A conversation is test when its visitor is a test customer. */
export function notTestConversation(conversationId: SQLWrapper): SQL {
  return sql`not exists (select 1 from quills."conversations" test_conversation inner join quills."principal" test_visitor on test_visitor.id = test_conversation.visitor_principal_id where test_conversation.id = ${conversationId} and test_visitor.test_owner_principal_id is not null)`;
}

/** A ticket is test when a test customer requested it or it is linked to a test conversation. */
export function notTestTicket(ticketId: SQLWrapper): SQL {
  return sql`not exists (
    select 1 from quills."tickets" test_ticket
    where test_ticket.id = ${ticketId} and (
      not (${notTestPrincipal(sql`test_ticket.requester_principal_id`)})
      or exists (
        select 1 from quills."ticket_conversations" test_link
        where test_link.ticket_id = test_ticket.id
          and not (${notTestConversation(sql`test_link.conversation_id`)})
      )
    )
  )`;
}
