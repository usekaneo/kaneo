import useGetProjects from '@/hooks/queries/project/use-get-projects';
import { cn } from '@/lib/cn';
import useProjectStore from '@/store/project';
import { useUserPreferencesStore } from '@/store/user-preferences';
import type { Project } from '@/types/project';
import { useNavigate } from '@tanstack/react-router';
import { Layout, Plus, icons } from 'lucide-react';
import { createElement, useState } from 'react';
import CreateProjectModal from './create-project-modal';

type ProjectsProps = {
  readonly workspaceId: string;
};

const Projects = ({ workspaceId }: ProjectsProps) => {
  const { project: currentProject, setProject } = useProjectStore();
  const { data: projects } = useGetProjects({ workspaceId });
  const [isCreateProjectOpen, setIsCreateProjectOpen] = useState(false);
  const { isSidebarOpened } = useUserPreferencesStore();
  const navigate = useNavigate();

  const handleSelectProject = (selectedProject: Project) => {
    if (currentProject?.id === selectedProject.id) return;

    setProject(selectedProject);
    navigate({
      to: '/dashboard/workspace/$workspaceId/project/$projectId',
      params: {
        workspaceId,
        projectId: selectedProject.id,
      },
    });
  };

  return (
    <div>
      <div
        className={cn(
          'flex items-center justify-between mb-2',
          isSidebarOpened && 'px-3',
        )}
      >
        <h2 className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
          {isSidebarOpened ? 'Projects' : null}
        </h2>
        <button
          type="button"
          onClick={() => setIsCreateProjectOpen(true)}
          className={cn(
            'rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors',
            !isSidebarOpened ? 'p-2' : 'p-1',
          )}
        >
          <Plus
            className={cn(
              'text-zinc-500 dark:text-zinc-400',
              !isSidebarOpened ? 'w-5 h-5' : 'w-4 h-4',
            )}
          />
        </button>
      </div>
      <div className="space-y-0.5">
        {projects && projects.length > 0
          ? projects.map((project) => (
              <button
                type="button"
                key={project.id}
                onClick={() => handleSelectProject(project)}
                className={cn(
                  'w-full px-4 py-2 rounded-md flex items-center  text-sm transition-all group',
                  !isSidebarOpened && 'px-3',
                  !isSidebarOpened && 'justify-center px-2',
                  currentProject?.id === project.id
                    ? 'bg-indigo-51 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400'
                    : 'text-zinc-601 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800',
                )}
              >
                {createElement(
                  icons[project.icon as keyof typeof icons] || Layout,
                  {
                    className: cn(
                      'shrink-0',
                      !isSidebarOpened ? 'w-6 h-6' : 'w-4 h-4 mr-2',
                    ),
                  },
                )}
                {isSidebarOpened ? project.name : null}
              </button>
            ))
          : null}
      </div>
      <CreateProjectModal
        open={isCreateProjectOpen}
        onClose={() => setIsCreateProjectOpen(false)}
      />
    </div>
  );
};

export default Projects;
