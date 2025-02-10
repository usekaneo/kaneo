import { cn } from '@/lib/cn';
import { ChevronDown, ChevronRight, Folder, FolderOpen } from 'lucide-react';
import { Fragment } from 'react/jsx-runtime';
import Projects from '../../projects';
import WorkspaceMenu from './workspace-menu';

type WorkspaceItemProps = {
  readonly workspace: {
    id: string;
    name: string;
  };
  readonly isExpanded: boolean;
  readonly onExpandWorkspace: (id: string) => void;
  readonly onSelectWorkspace: (
    event:
      | React.KeyboardEvent<HTMLDivElement>
      | React.MouseEvent<HTMLDivElement>,
    id: string,
  ) => void;
};

const WorkspaceItem = ({
  workspace,
  isExpanded,
  onSelectWorkspace,
  onExpandWorkspace,
}: WorkspaceItemProps) => {
  return (
    <Fragment>
      <div
        onClick={(e) => onSelectWorkspace(e, workspace.id)}
        onKeyUp={(e) => e.key === 'Enter' && onSelectWorkspace(e, workspace.id)}
        onKeyDown={(e) =>
          e.key === 'Enter' && onSelectWorkspace(e, workspace.id)
        }
        className={cn(
          'w-full text-left px-2 py-1.5 rounded-md flex items-center transition-all cursor-pointer group',
          'hover:bg-zinc-100 dark:hover:bg-zinc-800/50',
          isExpanded && 'bg-zinc-50 dark:bg-zinc-800/30',
        )}
      >
        <button
          type="button"
          onClick={() => onExpandWorkspace(workspace.id)}
          className="p-1 rounded-md mr-1 hover:bg-zinc-200 dark:hover:bg-zinc-700/50 transition-colors"
        >
          {isExpanded ? (
            <ChevronDown className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />
          )}
        </button>
        {isExpanded ? (
          <FolderOpen className="w-4 h-4 mr-2 text-indigo-500 dark:text-indigo-400" />
        ) : (
          <Folder className="w-4 h-4 mr-2 text-zinc-400 dark:text-zinc-500 group-hover:text-zinc-500 dark:group-hover:text-zinc-400" />
        )}
        <span
          className={cn(
            'text-sm font-medium',
            isExpanded
              ? 'text-zinc-900 dark:text-zinc-100'
              : 'text-zinc-600 dark:text-zinc-400 group-hover:text-zinc-900 dark:group-hover:text-zinc-300',
          )}
        >
          {workspace.name}
        </span>
        <WorkspaceMenu id={workspace?.id} />
      </div>
      {isExpanded ? <Projects workspaceId={workspace?.id} /> : null}
    </Fragment>
  );
};

export default WorkspaceItem;
