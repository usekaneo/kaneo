import {
  createFileRoute,
  useNavigate,
  useSearch,
} from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod/v4";
import { AuthLayout } from "@/components/auth/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";
import { toast } from "@/lib/toast";

const deviceSearchSchema = z.object({
  user_code: z.string().optional(),
});

export const Route = createFileRoute("/device/")({
  component: DevicePage,
  validateSearch: deviceSearchSchema,
});

function DevicePage() {
  const navigate = useNavigate();
  const search = useSearch({ from: "/device/" });
  const [code, setCode] = useState(search.user_code ?? "");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const formatted = code.trim().replace(/-/g, "").toUpperCase();
    if (formatted.length < 4) {
      toast.error("Enter the code shown on your device.");
      return;
    }
    setLoading(true);
    try {
      const res = await authClient.device({
        query: { user_code: formatted },
      });
      if (res.error) {
        toast.error(
          "error_description" in res.error
            ? String(res.error.error_description)
            : "Invalid or expired code",
        );
        return;
      }
      void navigate({
        to: "/device/approve",
        search: { user_code: formatted },
      });
    } catch {
      toast.error("Invalid or expired code");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Connect a device"
      subtitle="Enter the code from your CLI or app to continue."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="e.g. ABCD-1234"
          autoCapitalize="characters"
          autoComplete="one-time-code"
        />
        <Button type="submit" className="w-full" disabled={loading}>
          Continue
        </Button>
      </form>
    </AuthLayout>
  );
}
