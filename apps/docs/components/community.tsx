import { Github, MessageSquare, Twitter } from "lucide-react";

export default function Community() {
  return (
    <div className="py-16 bg-white dark:bg-zinc-950" id="community">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-white sm:text-4xl animate-fade-in">
            Built by the community
          </h2>
          <p className="mt-4 text-lg text-zinc-600 dark:text-zinc-400 animate-fade-in-delay">
            Join us in making project management accessible to everyone
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-3">
          <a
            href="https://github.com/orgs/usekaneo/discussions"
            target="_blank"
            rel="noopener noreferrer"
            className="community-item group relative rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors animate-fade-in-up-0"
          >
            <Github className="h-6 w-6 text-zinc-600 dark:text-zinc-400 mb-3 group-hover:text-zinc-900 dark:group-hover:text-white transition-colors" />
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-2">
              GitHub Discussions
            </h3>
            <p className="text-zinc-600 dark:text-zinc-400">
              Share ideas and connect with developers
            </p>
          </a>

          <a
            href="https://discord.gg/rU4tSyhXXU"
            target="_blank"
            rel="noopener noreferrer"
            className="community-item group relative rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors animate-fade-in-up-1"
          >
            <MessageSquare className="h-6 w-6 text-zinc-600 dark:text-zinc-400 mb-3 group-hover:text-zinc-900 dark:group-hover:text-white transition-colors" />
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-2">
              Discord Community
            </h3>
            <p className="text-zinc-600 dark:text-zinc-400">
              Get real-time help and chat with us
            </p>
          </a>

          <a
            href="https://x.com/usekaneo"
            target="_blank"
            rel="noopener noreferrer"
            className="community-item group relative rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors animate-fade-in-up-2"
          >
            <Twitter className="h-6 w-6 text-zinc-600 dark:text-zinc-400 mb-3 group-hover:text-zinc-900 dark:group-hover:text-white transition-colors" />
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-2">
              Twitter Updates
            </h3>
            <p className="text-zinc-600 dark:text-zinc-400">
              Stay updated with latest news
            </p>
          </a>
        </div>

        <div className="mt-12 text-center animate-fade-in-delay-2">
          <a
            href="https://github.com/usekaneo/kaneo"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 shadow h-9 px-4 py-2 bg-indigo-600 text-white hover:bg-indigo-500 dark:bg-indigo-500 dark:hover:bg-indigo-400"
          >
            <Github className="w-4 h-4 mr-2" />
            View on GitHub
          </a>
        </div>
      </div>
    </div>
  );
}
