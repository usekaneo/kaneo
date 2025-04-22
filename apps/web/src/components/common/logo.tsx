import useProjectStore from "@/store/project";
import useWorkspaceStore from "@/store/workspace";
import { Link } from "@tanstack/react-router";
import { LayoutGrid } from "lucide-react";

interface LogoProps {
  className?: string;
}

export function Logo({ className = "" }: LogoProps) {
  const { setWorkspace } = useWorkspaceStore();
  const { setProject } = useProjectStore();

  return (
    <Link
      onClick={() => {
        setWorkspace(undefined);
        setProject(undefined);
      }}
      to="/dashboard"
      className={`flex items-center gap-2 ${className}`}
    >
      <div className="p-1.5">
        <LayoutGrid className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
      </div>
      <span className="text-lg text-zinc-900 dark:text-white font-semibold">
        Kaneo
      </span>
    </Link>
  );
}
