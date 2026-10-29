import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";
import { ADMIN_AUDIT_LOG_PAGE_SIZE } from "./audit-log-types";

export async function getAdminAuditLog(category: string, page: number) {
  const response = await client.admin["audit-log"].$get({
    query: {
      ...(category ? { action: category } : {}),
      page: String(page + 1),
      limit: String(ADMIN_AUDIT_LOG_PAGE_SIZE),
    },
  });

  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }

  return response.json();
}
