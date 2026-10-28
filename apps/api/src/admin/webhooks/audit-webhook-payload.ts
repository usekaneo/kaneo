export type AuditWebhookPayload = {
  id: string;
  action: string;
  actorUserId: string | null;
  actorName: string | null;
  actorEmail: string | null;
  targetType: string;
  targetId: string | null;
  targetLabel: string | null;
  metadata: Record<string, unknown> | null;
  ipAddress: string | null;
  createdAt: string;
};
