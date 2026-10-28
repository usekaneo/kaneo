import { useQuery } from "@tanstack/react-query";
import useAuth from "@/components/providers/auth-provider/hooks/use-auth";
import { getAdminAuditLog } from "@/fetchers/admin/get-admin-audit-log";

export {
  ADMIN_AUDIT_LOG_PAGE_SIZE,
  type AdminAuditLogEntry,
} from "@/fetchers/admin/audit-log-types";

export const ADMIN_AUDIT_LOG_QUERY_KEY = ["admin", "audit-log"] as const;

function useAdminAuditLog(category: string, page: number) {
  const { user } = useAuth();
  const userId = user?.id ?? "";
  return useQuery({
    queryKey: [...ADMIN_AUDIT_LOG_QUERY_KEY, userId, category, page],
    queryFn: () => getAdminAuditLog(category, page),
    enabled: userId !== "",
    placeholderData: (previousData, previousQuery) =>
      userId !== "" && previousQuery?.queryKey[2] === userId
        ? previousData
        : undefined,
  });
}

export default useAdminAuditLog;
