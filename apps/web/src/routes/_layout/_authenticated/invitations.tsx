import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { CheckCircle, Loader2, Mail, X } from "lucide-react";
import { useState } from "react";
import PageTitle from "@/components/page-title";
import useAuth from "@/components/providers/auth-provider/hooks/use-auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { usePendingInvitations } from "@/hooks/queries/invitation/use-pending-invitations";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/cn";
import { toast } from "@/lib/toast";

export const Route = createFileRoute("/_layout/_authenticated/invitations")({
  component: InvitationsPage,
});

function InvitationsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: invitations = [], isLoading } = usePendingInvitations();
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const { user } = useAuth();

  const handleSkip = () => {
    if (!user?.name) {
      navigate({ to: "/profile-setup" });
      return;
    }
    navigate({ to: "/onboarding" });
  };

  const handleAcceptInvitation = async (
    invitationId: string,
    organizationId: string,
  ) => {
    setAcceptingId(invitationId);
    try {
      const { data, error } = await authClient.organization.acceptInvitation({
        invitationId,
      });

      if (error) {
        toast.error(error.message || "Failed to accept invitation");
        return;
      }

      await authClient.organization.setActive({
        organizationId: data?.invitation.organizationId || organizationId,
      });

      toast.success("Invitation accepted! Welcome to the team.");

      await queryClient.invalidateQueries({
        queryKey: ["invitations", "pending"],
      });

      navigate({
        to: "/dashboard/workspace/$workspaceId",
        params: {
          workspaceId: data?.invitation.organizationId || organizationId,
        },
      });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to accept invitation",
      );
    } finally {
      setAcceptingId(null);
    }
  };

  const handleRejectInvitation = async (invitationId: string) => {
    setRejectingId(invitationId);
    try {
      const { error } = await authClient.organization.rejectInvitation({
        invitationId,
      });

      if (error) {
        toast.error(error.message || "Failed to reject invitation");
        return;
      }

      toast.success("Invitation rejected");

      await queryClient.invalidateQueries({
        queryKey: ["invitations", "pending"],
      });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to reject invitation",
      );
    } finally {
      setRejectingId(null);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const getExpiryStatus = (expiresAt: string) => {
    const expiryDate = new Date(expiresAt);
    const now = new Date();
    const daysDiff = Math.ceil(
      (expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
    );

    const formattedDate = formatDate(expiresAt);

    if (daysDiff <= 1) {
      return {
        label: `${formattedDate}`,
        variant: "destructive" as const,
        isUrgent: true,
      };
    }
    if (daysDiff <= 3) {
      return {
        label: `${formattedDate}`,
        variant: "secondary" as const,
        isUrgent: true,
      };
    }
    return {
      label: formattedDate,
      variant: null,
      isUrgent: false,
    };
  };

  return (
    <>
      <PageTitle title="Invitations" />
      <div className="flex w-full min-h-screen items-center justify-center p-6 bg-background">
        <div className="w-full max-w-2xl space-y-8">
          <div className="space-y-3 text-center">
            <h1 className="text-3xl font-semibold">Pending Invitations</h1>
            <p className="text-sm text-muted-foreground">
              Accept invitations to join workspaces
            </p>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : invitations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted/50 mb-4">
                <Mail className="h-8 w-8 text-muted-foreground/60" />
              </div>
              <h3 className="text-base font-semibold mb-2">
                No pending invitations
              </h3>
              <p className="text-sm text-muted-foreground max-w-md mb-6">
                You don't have any pending workspace invitations at the moment.
              </p>
              <Button onClick={handleSkip} variant="default">
                Continue to Setup
              </Button>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="rounded-lg border bg-card shadow-sm">
                <Table>
                  <TableHeader>
                    <TableRow className="border-b">
                      <TableHead className="font-semibold">Workspace</TableHead>
                      <TableHead className="font-semibold">
                        Invited By
                      </TableHead>
                      <TableHead className="font-semibold">Expires</TableHead>
                      <TableHead className="w-[100px]" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invitations.map((invitation) => {
                      const expiryStatus = getExpiryStatus(
                        invitation.expiresAt,
                      );
                      const isAccepting = acceptingId === invitation.id;
                      const isRejecting = rejectingId === invitation.id;
                      const isProcessing = isAccepting || isRejecting;

                      return (
                        <TableRow
                          key={invitation.id}
                          className={cn(
                            expiryStatus.isUrgent &&
                              expiryStatus.variant === "destructive" &&
                              "bg-destructive/5",
                          )}
                        >
                          <TableCell className="font-medium">
                            {invitation.workspaceName}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {invitation.inviterName}
                          </TableCell>
                          <TableCell>
                            {expiryStatus.isUrgent && expiryStatus.variant ? (
                              <Badge
                                variant={expiryStatus.variant}
                                className="text-xs font-normal"
                              >
                                {expiryStatus.label}
                              </Badge>
                            ) : (
                              <span className="text-sm text-muted-foreground">
                                {expiryStatus.label}
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  handleAcceptInvitation(
                                    invitation.id,
                                    invitation.workspaceId,
                                  )
                                }
                                disabled={isProcessing}
                                className="h-7 w-7 p-0"
                              >
                                {isAccepting ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <CheckCircle className="h-3 w-3" />
                                )}
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  handleRejectInvitation(invitation.id)
                                }
                                disabled={isProcessing}
                                className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                              >
                                {isRejecting ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <X className="h-3 w-3" />
                                )}
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              <div className="flex justify-center pt-2">
                <Button
                  variant="ghost"
                  onClick={handleSkip}
                  className="text-muted-foreground hover:text-foreground"
                >
                  Skip for now
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
