import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, User } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod/v4";

import { Logo } from "@/components/common/logo";
import PageTitle from "@/components/page-title";
import useAuth from "@/components/providers/auth-provider/hooks/use-auth";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import useUpdateUserProfile from "@/hooks/mutations/use-update-user-profile";

type ProfileSetupStep = "profile" | "success";

export type ProfileFormValues = {
  name: string;
};

const profileSchema = z.object({
  name: z
    .string()
    .min(1, "Name is required")
    .min(2, "Name must be at least 2 characters"),
});

const fadeTransition = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 },
};

export function ProfileSetupFlow() {
  const [step, setStep] = useState<ProfileSetupStep>("profile");
  const [userName, setUserName] = useState("");
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { mutateAsync: updateProfile, isPending } = useUpdateUserProfile();
  const { user } = useAuth();

  const form = useForm<ProfileFormValues>({
    resolver: standardSchemaResolver(profileSchema),
    defaultValues: {
      name: user?.name || "",
    },
  });

  const onSubmit = async (data: ProfileFormValues) => {
    try {
      await updateProfile({
        name: data.name.trim(),
      });

      await queryClient.invalidateQueries({ queryKey: ["session"] });
      setUserName(data.name);
      toast.success("Profile updated successfully");

      setStep("success");

      setTimeout(() => {
        navigate({
          to: "/dashboard",
          replace: true,
        });
      }, 1500);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update profile",
      );
    }
  };

  const renderProfileStep = () => (
    <motion.div
      key="profile"
      variants={fadeTransition}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={{ duration: 0.3 }}
      className="w-full max-w-sm mx-auto"
    >
      <Logo className="mx-auto mb-6 w-full flex items-end justify-center" />

      <div className="bg-card/50 backdrop-blur-xl rounded-xl border border-border/50 p-6 shadow-xl shadow-background/20">
        <div className="text-center mb-6">
          <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <User className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-xl font-bold text-foreground mb-2">
            Complete your profile
          </h1>
          <p className="text-muted-foreground text-sm">
            Please enter your name to get started
          </p>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium">
                    Your name
                  </FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. John Doe" autoFocus {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit" disabled={isPending} className="w-full mt-6">
              {isPending ? "Saving..." : "Continue"}
            </Button>
          </form>
        </Form>
      </div>
    </motion.div>
  );

  const renderSuccessStep = () => (
    <motion.div
      key="success"
      variants={fadeTransition}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={{ duration: 0.3 }}
      className="w-full max-w-sm mx-auto"
    >
      <Logo className="mx-auto mb-6 w-full flex items-end justify-center" />

      <div className="bg-card/50 backdrop-blur-xl rounded-xl border border-border/50 p-6 shadow-xl shadow-background/20">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400" />
          </div>

          <div className="space-y-2">
            <h1 className="text-xl font-bold text-foreground">
              Welcome, {userName}!
            </h1>
            <p className="text-muted-foreground text-sm">
              Taking you to your dashboard...
            </p>
          </div>

          <div className="w-6 h-6 mx-auto">
            <div className="animate-spin rounded-full h-6 w-6 border-2 border-border border-t-foreground" />
          </div>
        </div>
      </div>
    </motion.div>
  );

  return (
    <>
      <PageTitle title="Complete Profile" />
      <div className="min-h-screen w-full bg-background flex flex-col items-center justify-center p-4">
        <AnimatePresence mode="wait">
          {step === "profile" && renderProfileStep()}
          {step === "success" && renderSuccessStep()}
        </AnimatePresence>
      </div>
    </>
  );
}
