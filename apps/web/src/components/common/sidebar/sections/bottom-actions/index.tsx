import { cn } from "@/lib/cn";
import { useUserPreferencesStore } from "@/store/user-preferences";
import { useNavigate } from "@tanstack/react-router";
import { Settings } from "lucide-react";
import SignOutButton from "./sign-out-button";

function BottomActions() {
  const { isSidebarOpened } = useUserPreferencesStore();
  const navigate = useNavigate();

  const handleClickSettings = () => {
    navigate({ to: "/dashboard/settings/appearance" });
  };

  return (
    <div className={cn("flex gap-1", !isSidebarOpened && "hidden")}>
      <button
        type="button"
        onClick={handleClickSettings}
        className="flex-1 px-2 py-1.5 text-xs text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800 rounded-lg flex items-center justify-center transition-colors"
      >
        <Settings className="w-3 h-3 mr-1" />
        Settings
      </button>
      <SignOutButton />
    </div>
  );
}

export default BottomActions;
