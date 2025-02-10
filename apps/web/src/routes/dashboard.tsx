import { Sidebar } from '@/components/common/sidebar';
import { Outlet, redirect, createFileRoute } from '@tanstack/react-router';

const DashboardIndexRouteComponent = () => {
  return (
    <>
      <Sidebar />
      <main className="flex-1 overflow-hidden p-6 scroll-smooth">
        <Outlet />
      </main>
    </>
  );
};

export const Route = createFileRoute('/dashboard')({
  component: DashboardIndexRouteComponent,
  beforeLoad({ context: { user } }) {
    if (user === null) {
      throw redirect({
        to: '/auth/sign-in',
      });
    }
  },
});
