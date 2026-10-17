import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import useAuth from "@/components/providers/auth-provider/hooks/use-auth";
import { Spinner } from "@/components/ui/spinner";
import {
  DEFAULT_WORKSPACE_USAGE,
  type WorkspaceUsage,
} from "@/constants/onboarding";
import { getBilling } from "@/fetchers/billing/get-billing";
import { useCreateCheckout } from "@/hooks/mutations/billing/use-billing-actions";
import useGetConfig from "@/hooks/queries/config/use-get-config";
import useCreateWorkspace from "@/hooks/queries/workspace/use-create-workspace";
import useWorkspaceCreationAccess from "@/hooks/use-workspace-creation-access";
import { track } from "@/lib/analytics/track";
import { authClient } from "@/lib/auth-client";
import {
  getTrialState,
  recommendedPlanFor,
  type TrialState,
} from "@/lib/billing";
import { clearCheckoutIntent, readCheckoutIntent } from "@/lib/checkout-intent";
import generateProjectSlug from "@/lib/generate-project-id";
import {
  createStarterProject,
  FALLBACK_PROJECT_SLUG,
} from "@/lib/onboarding/create-starter-project";
import { starterTasks } from "@/lib/onboarding/starter-tasks";
import { toast } from "@/lib/toast";
import { InviteStep } from "./invite-step";
import { OnboardingRestricted } from "./onboarding-restricted";
import { OnboardingShell } from "./onboarding-shell";
import {
  getInitials,
  getNextStep,
  getOnboardingSteps,
  getStepProgress,
  type OnboardingStepId,
} from "./onboarding-steps";
import { PlanStep } from "./plan-step";
import type { PreviewFocus } from "./preview/preview-focus";
import { WorkspacePreview } from "./preview/workspace-preview";
import { ProjectStep } from "./project-step";
import { ReadyStep } from "./ready-step";
import { UsageStep } from "./usage-step";
import { WorkspaceStep } from "./workspace-step";

type CreatedWorkspace = { workspaceId: string; projectId: string | null };

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const focusByStep: Partial<Record<OnboardingStepId, PreviewFocus>> = {
  workspace: "workspace",
  project: "project",
  invite: "members",
};

export function OnboardingFlow() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { mutateAsync: createWorkspace } = useCreateWorkspace();
  const { isCreationRestricted, isDecided: isAccessDecided } =
    useWorkspaceCreationAccess();
  const { data: config, isPending: isConfigPending } = useGetConfig();
  const isDecided = isAccessDecided && !isConfigPending;
  const isCloud = config?.isCloud === true;

  const [step, setStep] = useState<OnboardingStepId>("workspace");
  const [workspaceName, setWorkspaceName] = useState("");
  const [usage, setUsage] = useState<WorkspaceUsage>(DEFAULT_WORKSPACE_USAGE);
  const [projectName, setProjectName] = useState(() =>
    t("auth:onboarding.projectNameDefault"),
  );
  const [inviteEmails, setInviteEmails] = useState<string[]>([]);
  const [invitedCount, setInvitedCount] = useState(0);
  const [created, setCreated] = useState<CreatedWorkspace | null>(null);
  const [trial, setTrial] = useState<TrialState | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [opening, setOpening] = useState(false);
  const [intent] = useState(readCheckoutIntent);
  const checkout = useCreateCheckout(created?.workspaceId);

  const canInvite = isCloud || config?.hasSmtp === true;
  const offersPlan = trial
    ? trial.kind !== "none"
    : isCloud && config?.billingEnabled === true;
  const steps = getOnboardingSteps({ usage, canInvite, offersPlan });
  const name = workspaceName.trim();
  const ownerInitial = getInitials(user?.name || user?.email || "");
  const projectKey = generateProjectSlug(projectName) || FALLBACK_PROJECT_SLUG;
  const stepIndex = steps.indexOf(step);
  const reachedUsage = stepIndex >= steps.indexOf("usage");
  const reachedProject = stepIndex >= steps.indexOf("project");
  const tasks = useMemo(
    () =>
      starterTasks(t, usage).map((task, position) => ({
        id: `task-${position}`,
        ticket: `${projectKey}-${position + 1}`,
        title: task.title,
      })),
    [t, usage, projectKey],
  );
  const invitedInitials = inviteEmails
    .filter((email) => EMAIL_PATTERN.test(email.trim()))
    .map(getInitials);

  const goToWorkspace = useCallback(() => {
    if (!created) return;
    if (created.projectId) {
      navigate({
        to: "/dashboard/workspace/$workspaceId/project/$projectId/board",
        params: {
          workspaceId: created.workspaceId,
          projectId: created.projectId,
        },
        replace: true,
      });
      return;
    }
    navigate({
      to: "/dashboard/workspace/$workspaceId",
      params: { workspaceId: created.workspaceId },
      replace: true,
    });
  }, [created, navigate]);

  const createWorkspaceAndProject = async () => {
    setIsCreating(true);
    try {
      const workspace = await createWorkspace({
        name,
        description: "",
        userId: user?.id,
      });
      track("Workspace Created", { props: { usage } });
      await queryClient.invalidateQueries({ queryKey: ["workspaces"] });
      await authClient.organization.setActive({ organizationId: workspace.id });
      const projectId = await createStarterProject({
        workspaceId: workspace.id,
        name: projectName.trim(),
        tasks: starterTasks(t, usage),
      }).catch(() => null);
      await queryClient.invalidateQueries({ queryKey: ["projects"] });

      let trialState: TrialState = { kind: "none" };
      if (isCloud) {
        try {
          const billing = await queryClient.fetchQuery({
            queryKey: ["billing", workspace.id],
            queryFn: () => getBilling(workspace.id),
          });
          trialState = getTrialState(billing);
        } catch {}
      }

      setCreated({ workspaceId: workspace.id, projectId });
      setTrial(trialState);
      setStep(
        getNextStep(
          getOnboardingSteps({
            usage,
            canInvite,
            offersPlan: trialState.kind !== "none",
          }),
          "project",
        ),
      );
    } catch (error) {
      toast.error(
        error instanceof Error && error.message
          ? error.message
          : t("auth:onboarding.toast.createFailed"),
      );
    } finally {
      setIsCreating(false);
    }
  };

  const startTrial = () => {
    clearCheckoutIntent();
    setOpening(true);
  };

  const signOut = async () => {
    await authClient.signOut().catch(() => undefined);
    navigate({ to: "/auth/sign-in" });
  };

  if (step === "workspace" && !isDecided) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-background">
        <Spinner className="size-6 text-muted-foreground" />
      </div>
    );
  }

  if (step === "workspace" && isCreationRestricted) {
    return <OnboardingRestricted />;
  }

  const stepContent = () => {
    switch (step) {
      case "workspace":
        return (
          <WorkspaceStep
            value={workspaceName}
            onChange={setWorkspaceName}
            onContinue={() => setStep("usage")}
          />
        );
      case "usage":
        return (
          <UsageStep
            value={usage}
            ownerInitial={ownerInitial}
            onChange={setUsage}
            onContinue={() => setStep("project")}
          />
        );
      case "project":
        return (
          <ProjectStep
            value={projectName}
            projectKey={projectKey}
            isSubmitting={isCreating}
            onChange={setProjectName}
            onContinue={createWorkspaceAndProject}
          />
        );
      case "invite":
        return created ? (
          <InviteStep
            workspaceId={created.workspaceId}
            onEmailsChange={setInviteEmails}
            onDone={(sent) => {
              setInvitedCount(sent);
              setStep(getNextStep(steps, "invite"));
            }}
          />
        ) : null;
      case "plan":
        return (
          <PlanStep
            canTrial={trial?.kind === "active"}
            recommended={recommendedPlanFor(usage)}
            intent={intent}
            isStartingCheckout={checkout.isPending}
            onStartTrial={startTrial}
            onSubscribe={(choice) => {
              clearCheckoutIntent();
              checkout.mutate(choice);
            }}
          />
        );
      default:
        return (
          <ReadyStep
            workspaceName={name}
            projectName={projectName.trim()}
            taskCount={tasks.length}
            invitedCount={invitedCount}
            opening={opening}
            onOpen={() => setOpening(true)}
          />
        );
    }
  };

  const headings: Record<
    OnboardingStepId,
    { eyebrow?: string; title: string; description?: string }
  > = {
    workspace: {
      eyebrow: user?.name
        ? t("auth:onboarding.welcome", { name: user.name.split(" ")[0] })
        : undefined,
      title: t("auth:onboarding.workspace.title"),
      description: t("auth:onboarding.workspace.description"),
    },
    usage: {
      eyebrow: t("auth:onboarding.settingUp", { name }),
      title: t("auth:onboarding.usage.title"),
      description: t("auth:onboarding.usage.description", { name }),
    },
    project: {
      eyebrow: t("auth:onboarding.settingUp", { name }),
      title: t("auth:onboarding.project.title"),
      description: t("auth:onboarding.project.description"),
    },
    invite: {
      eyebrow: t("auth:onboarding.settingUp", { name }),
      title: t("auth:onboarding.invite.title"),
      description: t("auth:onboarding.invite.description", { name }),
    },
    plan: {
      eyebrow: t("auth:onboarding.settingUp", { name }),
      title: t("auth:onboarding.plan.title"),
      description:
        trial?.kind === "active"
          ? t("auth:onboarding.plan.descriptionTrial", {
              name,
              count: trial.daysLeft,
            })
          : t("auth:onboarding.cloud.plan.trialUsed"),
    },
    ready: {
      eyebrow: t("auth:onboarding.ready.eyebrow"),
      title: t("auth:onboarding.ready.title", { name }),
      description: t("auth:onboarding.ready.description"),
    },
  };
  const heading = headings[step];
  const progress = step === "ready" ? null : getStepProgress(steps, step);

  return (
    <OnboardingShell
      stepKey={step}
      progress={progress}
      eyebrow={heading.eyebrow}
      title={heading.title}
      description={heading.description}
      email={user?.email}
      opening={opening}
      onSignOut={signOut}
      preview={
        <WorkspacePreview
          label={
            step === "ready"
              ? t("auth:onboarding.preview.ready", { name })
              : name
                ? t("auth:onboarding.preview.live", { name })
                : t("auth:onboarding.preview.liveNoName")
          }
          workspaceName={name || t("auth:onboarding.preview.untitled")}
          projectName={reachedProject ? projectName.trim() || null : null}
          tasks={reachedProject ? tasks : null}
          focus={
            step === "usage"
              ? usage === "team"
                ? "members"
                : null
              : (focusByStep[step] ?? null)
          }
          ownerInitial={ownerInitial}
          invitedInitials={invitedInitials}
          emptySeats={invitedInitials.length === 0 ? 2 : 0}
          showMembers={reachedUsage && usage === "team"}
          opening={opening}
          onOpened={goToWorkspace}
        />
      }
    >
      {stepContent()}
    </OnboardingShell>
  );
}
