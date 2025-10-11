import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod/v4";
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
import { authClient } from "@/lib/auth-client";

export type MagicLinkSignInFormValues = {
  email: string;
};

const magicLinkSchema = z.object({
  email: z.email(),
});

export function MagicLinkSignInForm() {
  const [isPending, setIsPending] = useState(false);
  const navigate = useNavigate();
  const form = useForm<MagicLinkSignInFormValues>({
    resolver: standardSchemaResolver(magicLinkSchema),
    defaultValues: {
      email: "",
    },
  });

  const onSubmit = async (data: MagicLinkSignInFormValues) => {
    setIsPending(true);
    try {
      const result = await authClient.signIn.magicLink({
        email: data.email,
        callbackURL: `${import.meta.env.VITE_CLIENT_URL}/profile-setup`,
      });

      if (result.error) {
        toast.error(result.error.message || "Failed to send magic link");
        return;
      }

      toast.success("Magic link sent! Check your email to sign in.");
      navigate({
        to: "/auth/check-email",
        search: { email: data.email },
      });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to send magic link",
      );
    } finally {
      setIsPending(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
        <div className="space-y-3">
          <FormField
            control={form.control}
            name="email"
            render={({ field, fieldState }) => (
              <FormItem>
                <FormLabel className="text-sm font-medium">Email</FormLabel>
                <FormControl>
                  <Input
                    placeholder="me@example.com"
                    type="email"
                    autoComplete="email"
                    {...field}
                  />
                </FormControl>
                <FormMessage>{fieldState.error?.message}</FormMessage>
              </FormItem>
            )}
          />
        </div>

        <Button
          type="submit"
          disabled={isPending}
          className="w-full mt-4 text-white"
        >
          {isPending ? "Sending..." : "Send Magic Link"}
        </Button>
      </form>
    </Form>
  );
}
