import { useInstanceNameStore } from "@/store/instance-name";

export default function PageTitle({ title }: { title?: string }) {
  const instanceName = useInstanceNameStore((state) => state.instanceName);
  if (!title) return null;

  return (
    <title>
      {instanceName === "Kaneo" ? title : `${title} | ${instanceName}`}
    </title>
  );
}
