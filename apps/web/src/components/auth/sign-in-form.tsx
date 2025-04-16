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
import useSignIn from "@/hooks/mutations/use-sign-in";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "@tanstack/react-router";
import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { type ZodType, z } from "zod";
import useAuth from "../providers/auth-provider/hooks/use-auth";

export type SignInFormValues = {
  email: string;
  password: string;
};

const signInSchema: ZodType<SignInFormValues> = z.object({
  email: z.string().email(),
  password: z.string(),
});

export function SignInForm() {
  const [showPassword, setShowPassword] = useState(false);
  const { history } = useRouter();
  const { setUser } = useAuth();
  const { t } = useTranslation();
  const form = useForm<SignInFormValues>({
    resolver: zodResolver(signInSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });
  const { mutateAsync, isPending } = useSignIn();

  const onSubmit = async (data: SignInFormValues) => {
    try {
      const { data: user } = await mutateAsync({
        email: data.email,
        password: data.password,
      });
      setUser(user);
      toast.success("Signed in successfully");

      setTimeout(() => {
        history.push("/dashboard");
      }, 500);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to sign in");
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-4">
          <div>
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium text-zinc-300 mb-1.5 block">
                    {t("auth.email", { defaultValue: "Email" })}
                  </FormLabel>
                  <FormControl>
                    <Input
                      className="bg-white dark:bg-zinc-800/50 border-zinc-200 dark:border-zinc-700/50 text-zinc-900 dark:text-zinc-100"
                      placeholder={t("auth.email_placeholder", {
                        defaultValue: "you@example.com",
                      })}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div>
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium text-zinc-300 mb-1.5 block">
                    {t("auth.password", { defaultValue: "Password" })}
                  </FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        className="bg-white dark:bg-zinc-800/50 border-zinc-200 dark:border-zinc-700/50 text-zinc-900 dark:text-zinc-100"
                        placeholder={t("auth.password_placeholder", {
                          defaultValue: "••••••••",
                        })}
                        type={showPassword ? "text" : "password"}
                        {...field}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-300"
                      >
                        {showPassword ? (
                          <EyeOff size={16} />
                        ) : (
                          <Eye size={16} />
                        )}
                      </button>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex justify-end mt-1">
              <button
                type="button"
                className="text-sm text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300"
              >
                {t("auth.forgot_password", {
                  defaultValue: "Forgot password?",
                })}
              </button>
            </div>
          </div>
        </div>

        <Button
          type="submit"
          disabled={isPending}
          className="w-full bg-indigo-600 text-white hover:bg-indigo-500 dark:bg-indigo-500 dark:hover:bg-indigo-400 mt-6"
        >
          {isPending
            ? t("auth.signing_in", { defaultValue: "Signing In..." })
            : t("auth.sign_in", { defaultValue: "Sign In" })}
        </Button>
      </form>
    </Form>
  );
}
