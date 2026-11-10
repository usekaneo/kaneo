/**
 * Billable vs exempt email classes for the workspace meter.
 *
 * The monthly cap covers broadcast mail: changelog and status-page
 * subscriber sends. Inbox, ticket, feedback status, comments, mentions,
 * and auth mail do not draw from it. Unclassified senders fail the
 * mail-class-coverage trip-wire.
 */
export const METERED_EMAIL_TYPES = [
  "ChangelogPublishedEmail",
  "StatusIncidentPublishedEmail",
  "StatusMaintenanceScheduledEmail",
] as const;

export type MeteredEmailType = (typeof METERED_EMAIL_TYPES)[number];

export const EMAIL_BILLABLE: Record<string, boolean> = {
  ChangelogPublishedEmail: true,
  StatusIncidentPublishedEmail: true,
  StatusMaintenanceScheduledEmail: true,

  ConversationMessageEmail: false,
  ConversationReplyEmail: false,
  ConversationClosedEmail: false,
  ConversationAutoAckEmail: false,
  CsatRequestEmail: false,
  TicketEventEmail: false,
  StatusChangeEmail: false,
  NewCommentEmail: false,
  PostMentionEmail: false,
  NoteMentionEmail: false,
  FeedbackLinkedEmail: false,
  WelcomeEmail: false,
  OnboardingWelcomeEmail: false,
  OnboardingNudgeEmail: false,
  MessengerInstallEmail: false,

  MagicLinkEmail: false,
  PasswordResetEmail: false,
  RecoveryCodeUsedEmail: false,
  NewSignInEmail: false,
  SendingDomainAttentionEmail: false,
  InvitationEmail: false,
  PortalInviteEmail: false,
  VerifyAddressEmail: false,
  SignupNotAllowedEmail: false,
  RawEmail: false,
};

export function isEmailBillable(emailType: string | undefined): boolean {
  if (!emailType) return false;
  return EMAIL_BILLABLE[emailType] === true;
}

/**
 * Mail that is never sent under a workspace's provider tenant.
 *
 * Reputation is isolated per workspace by sending its mail under a tenant of
 * its own, and the provider pauses a tenant whose bounces or complaints run
 * high. Everything a person needs to get into their account, or to be told
 * about its security, stays outside that: a paused workspace must still be able
 * to sign in and fix what got it paused. So sign-in links and codes, the
 * refusal sent in place of one, password reset, address verification,
 * invitations to join, and sign-in and recovery alerts send untenanted, as they
 * would with tenants off. Every other type sends under the tenant.
 *
 * Every type is listed in one place or the other: a new type is classified in
 * {@link EMAIL_BILLABLE} and here, and a test holds the two key sets equal. An
 * unknown type sends untenanted, which is how every send behaved before
 * tenants existed.
 */
export const EMAIL_TENANTED: Record<string, boolean> = {
  ChangelogPublishedEmail: true,
  StatusIncidentPublishedEmail: true,
  StatusMaintenanceScheduledEmail: true,
  ConversationMessageEmail: true,
  ConversationReplyEmail: true,
  ConversationClosedEmail: true,
  ConversationAutoAckEmail: true,
  CsatRequestEmail: true,
  TicketEventEmail: true,
  StatusChangeEmail: true,
  NewCommentEmail: true,
  PostMentionEmail: true,
  NoteMentionEmail: true,
  FeedbackLinkedEmail: true,
  WelcomeEmail: true,
  OnboardingWelcomeEmail: true,
  OnboardingNudgeEmail: true,
  MessengerInstallEmail: true,
  SendingDomainAttentionEmail: true,
  RawEmail: true,

  MagicLinkEmail: false,
  SignupNotAllowedEmail: false,
  PasswordResetEmail: false,
  VerifyAddressEmail: false,
  InvitationEmail: false,
  PortalInviteEmail: false,
  RecoveryCodeUsedEmail: false,
  NewSignInEmail: false,
};

/** Whether mail of this type may be sent under the workspace's provider tenant. */
export function isTenantedEmailType(emailType: string | undefined): boolean {
  return EMAIL_TENANTED[emailType ?? "RawEmail"] === true;
}
