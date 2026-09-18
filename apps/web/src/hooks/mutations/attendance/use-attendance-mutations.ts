import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  type CreateSessionRequest,
  clockIn,
  clockOut,
  createAttendanceSession,
  deleteAttendanceSession,
  type UpdateSessionRequest,
  updateAttendanceSession,
} from "@/fetchers/attendance";

function useInvalidateAttendance() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ["attendance"] });
    queryClient.invalidateQueries({ queryKey: ["people"] });
  };
}

export function useClockIn(workspaceId: string) {
  const invalidate = useInvalidateAttendance();
  return useMutation({
    mutationFn: () => clockIn(workspaceId),
    onSuccess: invalidate,
  });
}

export function useClockOut(workspaceId: string) {
  const invalidate = useInvalidateAttendance();
  return useMutation({
    mutationFn: () => clockOut(workspaceId),
    onSuccess: invalidate,
  });
}

export function useCreateAttendanceSession() {
  const invalidate = useInvalidateAttendance();
  return useMutation({
    mutationFn: (json: CreateSessionRequest) => createAttendanceSession(json),
    onSuccess: invalidate,
  });
}

export function useUpdateAttendanceSession() {
  const invalidate = useInvalidateAttendance();
  return useMutation({
    mutationFn: ({ id, ...json }: UpdateSessionRequest & { id: string }) =>
      updateAttendanceSession(id, json),
    onSuccess: invalidate,
  });
}

export function useDeleteAttendanceSession(workspaceId: string) {
  const invalidate = useInvalidateAttendance();
  return useMutation({
    mutationFn: (id: string) => deleteAttendanceSession(workspaceId, id),
    onSuccess: invalidate,
  });
}
