import type { OptionMenuItem } from "@/components/common/option-menu/option-menu-item";
import { UnassignedAvatar } from "@/components/common/unassigned-avatar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getInitials } from "@/lib/get-initials";

type AssignableMember = {
  id: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
};

export function assigneeMenuOptions(
  members: AssignableMember[],
  current: string | null | undefined,
  unassignedLabel: string,
): OptionMenuItem[] {
  return [
    {
      value: "",
      label: unassignedLabel,
      icon: <UnassignedAvatar className="size-4 text-[8px]" />,
      selected: current !== undefined && !current,
    },
    ...members.map((member) => ({
      value: member.id,
      label: member.name || member.email || "",
      icon: (
        <Avatar className="size-4">
          <AvatarImage src={member.image ?? ""} alt="" />
          <AvatarFallback className="text-[8px]">
            {getInitials(member.name)}
          </AvatarFallback>
        </Avatar>
      ),
      selected: member.id === current,
    })),
  ];
}
