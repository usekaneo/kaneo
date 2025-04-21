import { GitFork, Github, Users } from "lucide-react";

async function fetchGitHubStats() {
  try {
    const [repoData, contributors] = await Promise.all([
      fetch("https://api.github.com/repos/usekaneo/kaneo", {
        next: { revalidate: 86400 },
      }),
      fetch("https://api.github.com/repos/usekaneo/kaneo/contributors", {
        next: { revalidate: 86400 },
      }),
    ]);

    if (!repoData.ok || !contributors.ok) {
      throw new Error("Failed to fetch GitHub data");
    }

    const repo = await repoData.json();
    const contributorsList = await contributors.json();

    return {
      stars: repo.stargazers_count.toLocaleString(),
      forks: repo.forks_count.toLocaleString(),
      contributors: contributorsList.length.toLocaleString(),
    };
  } catch (error) {
    console.error("Error fetching GitHub stats:", error);
    return {
      stars: "1490",
      forks: "90",
      contributors: "13",
    };
  }
}

export default async function Stats() {
  const stats = await fetchGitHubStats();

  const items = [
    {
      label: "GitHub Stars",
      value: stats.stars,
      icon: Github,
    },
    {
      label: "GitHub Forks",
      value: stats.forks,
      icon: GitFork,
    },
    {
      label: "Contributors",
      value: stats.contributors,
      icon: Users,
    },
  ];

  return (
    <div className="relative mt-[-120px]" id="stats">
      <div className="h-[200px] bg-gradient-to-b from-transparent to-white dark:to-zinc-950" />

      <div className="bg-white dark:bg-zinc-950 pb-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-white sm:text-4xl animate-fade-in">
              Built for developers
            </h2>
            <p className="mt-4 text-lg text-zinc-600 dark:text-zinc-400 animate-fade-in-delay">
              Join our growing open source community and help shape the future
              of project management
            </p>
          </div>

          <div className="grid grid-cols-1 gap-8 sm:grid-cols-3">
            {items.map((item) => (
              <div
                key={item.label}
                className="relative flex flex-col items-center"
              >
                <dt className="text-sm flex items-center gap-2 order-2 text-zinc-500 dark:text-zinc-400">
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </dt>
                <dd className="order-1 text-5xl font-semibold tracking-tight text-zinc-900 dark:text-white mb-2">
                  {item.value}
                </dd>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
