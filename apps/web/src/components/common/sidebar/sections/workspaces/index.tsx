import useWorkspaceStore from '@/store/workspace';
import Projects from '../projects';
import WorkspacePicker from './components/workspace-picker';

const Workspaces = () => {
  const { workspace } = useWorkspaceStore();

  return (
    <div>
      <div className="space-y-5 flex flex-col">
        <WorkspacePicker />
        {workspace ? <Projects workspaceId={workspace.id} /> : null}
      </div>
    </div>
  );
};

export default Workspaces;
