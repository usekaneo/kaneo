import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import useSignIn from '@/hooks/mutations/use-sign-in';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from '@tanstack/react-router';
import { AlertCircle, Eye, EyeOff } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { type ZodType, z } from 'zod';
import useAuth from '../providers/auth-provider/hooks/use-auth';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';

export type SignInFormValues = {
  email: string;
  password: string;
};

const signInSchema: ZodType<SignInFormValues> = z.object({
  email: z.string().email(),
  password: z.string(),
});

export const SignInForm = () => {
  const [showPassword, setShowPassword] = useState(false);
  const { history } = useRouter();
  const { setUser } = useAuth();
  const form = useForm<SignInFormValues>({
    resolver: zodResolver(signInSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });
  const { error, isError, mutateAsync, isPending } = useSignIn({
    email: form.getValues('email'),
    password: form.getValues('password'),
  });

  const onSubmit = async () => {
    const { data: user } = await mutateAsync();
    setUser(user);

    setTimeout(() => {
      history.push('/dashboard');
    }, 500);
  };

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="space-y-4"
      >
        <div className="space-y-4">
          <div>
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium text-zinc-300 mb-1.5 block">
                    Email
                  </FormLabel>
                  <FormControl>
                    <Input
                      className="bg-white dark:bg-zinc-800/50 border-zinc-200 dark:border-zinc-700/50 text-zinc-900 dark:text-zinc-100"
                      placeholder="you@example.com"
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
                    Password
                  </FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        className="bg-white dark:bg-zinc-800/50 border-zinc-200 dark:border-zinc-700/50 text-zinc-900 dark:text-zinc-100"
                        placeholder="••••••••"
                        type={showPassword ? 'text' : 'password'}
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
                Forgot password?
              </button>
            </div>
          </div>
        </div>
        {isError ? (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error.message}</AlertDescription>
          </Alert>
        ) : null}
        <Button
          type="submit"
          disabled={isPending}
          className="w-full bg-indigo-600 text-white hover:bg-indigo-500 dark:bg-indigo-500 dark:hover:bg-indigo-400 mt-6"
        >
          {isPending ? 'Signing In...' : 'Sign In'}
        </Button>
      </form>
    </Form>
  );
};
