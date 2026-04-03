import {
  createFileRoute,
  useNavigate,
  useSearch,
} from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod/v4";
import { AuthLayout } from "@/components/auth/layout";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { toast } from "@/lib/toast";

const approveSearchSchema = z.object({
  user_code: z.string().optional(),
});

export const Route = createFileRoute("/device/approve")({
  component: DeviceApprovePage,
  validateSearch: approveSearchSchema,
});

function DeviceApprovePage() {
  const navigate = useNavigate();
  const search = useSearch({ from: "/device/approve" });
  const { data: session, isPending } = authClient.useSession();
  const [processing, setProcessing] = useState(false);

  const normalizedCode =
    search.user_code?.trim().replace(/-/g, "").toUpperCase() ?? "";

  if (isPending) {
    return (
      <AuthLayout title="Approve device" subtitle="Loading…">
        <div className="text-sm text-muted-foreground">Checking session…</div>
      </AuthLayout>
    );
  }

  if (!session?.user) {
    if (!normalizedCode) {
      return (
        <AuthLayout
          title="Approve device"
          subtitle="No device code was provided."
        >
          <Button
            className="w-full"
            variant="secondary"
            onClick={() => void navigate({ to: "/device" })}
          >
            Enter a code
          </Button>
        </AuthLayout>
      );
    }
    const redirectTarget = `/device/approve?user_code=${encodeURIComponent(normalizedCode)}`;
    return (
      <AuthLayout
        title="Sign in to continue"
        subtitle="Sign in to approve or deny this device request."
      >
        <Button
          className="w-full"
          onClick={() =>
            void navigate({
              to: "/auth/sign-in",
              search: { redirect: redirectTarget },
            })
          }
        >
          Sign in
        </Button>
      </AuthLayout>
    );
  }

  if (!normalizedCode) {
    return (
      <AuthLayout
        title="Approve device"
        subtitle="No device code was provided."
      >
        <Button
          className="w-full"
          variant="secondary"
          onClick={() => void navigate({ to: "/device" })}
        >
          Enter a code
        </Button>
      </AuthLayout>
    );
  }

  const handleApprove = async () => {
    setProcessing(true);
    try {
      const res = await authClient.device.approve({
        userCode: normalizedCode,
      });
      if (res.error) {
        toast.error(res.error.error_description ?? "Could not approve");
        return;
      }
      toast.success("Device connected");
      void navigate({ to: "/dashboard" });
    } catch {
      toast.error("Could not approve");
    } finally {
      setProcessing(false);
    }
  };

  const handleDeny = async () => {
    setProcessing(true);
    try {
      const res = await authClient.device.deny({
        userCode: normalizedCode,
      });
      if (res.error) {
        toast.error(res.error.error_description ?? "Could not deny");
        return;
      }
      toast.message("Request cancelled");
      void navigate({ to: "/dashboard" });
    } catch {
      toast.error("Could not deny");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <AuthLayout
      title="Approve device"
      subtitle="A device is requesting access to your Kaneo account."
    >
      <div className="space-y-4">
        <p className="text-center font-mono text-sm tracking-wide">
          {normalizedCode}
        </p>
        <div className="flex gap-2">
          <Button
            className="flex-1"
            disabled={processing}
            onClick={() => void handleApprove()}
          >
            Approve
          </Button>
          <Button
            variant="outline"
            disabled={processing}
            onClick={() => void handleDeny()}
          >
            Deny
          </Button>
        </div>
      </div>
    </AuthLayout>
  );
}
