import InviteTeamMemberModal from '@/components/team/invite-team-member-modal';
import TeamTable from '@/components/team/team-table';
import { Button } from '@/components/ui/button';
import { Link, createFileRoute } from '@tanstack/react-router';
import { Shield, UserPlus, Users } from 'lucide-react';
import { useState } from 'react';

const menuItems = [
  {
    icon: Users,
    label: 'Members',
    path: '/team',
  },
  {
    icon: UserPlus,
    label: 'Invitations',
    path: '/team/invitations',
  },
  {
    icon: Shield,
    label: 'Roles',
    path: '/team/roles',
  },
];

const RouteComponent = () => {
  const [isInviteTeamMemberDialogOpened, setIsInviteTeamMemberDialogOpened] =
    useState(false);

  return (
    <div className="flex-1 flex h-screen">
      <aside className="w-64 border-r border-zinc-200 dark:border-zinc-800 p-6">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
          Team
        </h2>
        <nav className="space-y-1">
          {menuItems.map(({ icon: Icon, label, path }) => (
            <Link
              key={path}
              to={path}
              className={`flex items-center px-3 py-2 rounded-lg text-sm 
                ${
                  location.pathname === path
                    ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400'
                    : 'text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800'
                }`}
            >
              <Icon className="w-4 h-4 mr-3" />
              {label}
            </Link>
          ))}
        </nav>
      </aside>
      <div className="flex-1 p-6">
        <div className="w-full">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
              Team Members
            </h1>
            <Button
              className="bg-indigo-600 text-white hover:bg-indigo-500 dark:bg-indigo-500 dark:hover:bg-indigo-400"
              onClick={() => setIsInviteTeamMemberDialogOpened(true)}
            >
              <UserPlus className="w-4 h-4 mr-2" />
              Invite Member
            </Button>
          </div>
        </div>
        <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 overflow-hidden">
          <TeamTable />
        </div>
      </div>
      <InviteTeamMemberModal
        onClose={() => setIsInviteTeamMemberDialogOpened(false)}
        open={isInviteTeamMemberDialogOpened}
      />
    </div>
  );
};

export const Route = createFileRoute('/dashboard/workspace/$workspaceId/team')({
  component: RouteComponent,
});
