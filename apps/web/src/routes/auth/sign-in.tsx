import { createFileRoute } from '@tanstack/react-router';
import { AuthLayout } from '../../components/auth/layout';
import { SignInForm } from '../../components/auth/sign-in-form';
import { AuthToggle } from '../../components/auth/toggle';

const SignIn = () => {
  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Enter your credentials to access your workspace"
    >
      <SignInForm />
      <AuthToggle
        message="Don't have an account?"
        linkText="Create account"
        linkTo="/auth/sign-up"
      />
    </AuthLayout>
  );
};

export const Route = createFileRoute('/auth/sign-in')({
  component: SignIn,
});
