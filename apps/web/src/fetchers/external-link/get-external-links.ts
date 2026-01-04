import type { ExternalLink } from "@/types/external-link";

async function getExternalLinks(taskId: string): Promise<ExternalLink[]> {
  const response = await fetch(
    `${import.meta.env.VITE_API_URL || "http://localhost:1337"}/api/external-link/task/${taskId}`,
    {
      credentials: "include",
    },
  );

  if (!response.ok) {
    throw new Error("Failed to fetch external links");
  }

  return response.json();
}

export default getExternalLinks;
