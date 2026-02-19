import { useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import useActiveWorkspace from "@/hooks/queries/workspace/use-active-workspace";

export default function WorkspaceCrumbSelect() {
  const { data: workspace } = useActiveWorkspace();
  const navigate = useNavigate();

  return (
    <Button
      variant="ghost"
      size="xs"
      className="h-7 justify-between px-2 text-xs text-foreground"
      onClick={() => {
        navigate({
          to: "/dashboard/workspace/$workspaceId",
          params: { workspaceId: workspace?.id },
        });
      }}
    >
      <span className="truncate text-left">
        {workspace?.name || "Select workspace"}
      </span>
    </Button>
  );
}
