import {
  ExternalLink,
  Github,
  Heart,
  MessageSquare,
  Twitter,
} from "lucide-react";
import Link from "next/link";

export default function Footer() {
  return (
    <footer className="bg-zinc-100 dark:bg-zinc-950 border-t border-zinc-200 dark:border-zinc-900">
      <div className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
          {/* Logo and tagline */}
          <div className="flex flex-col">
            <div className="flex items-center">
              <div className="flex items-center justify-center bg-indigo-500/10 rounded p-1 mr-2">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="lucide lucide-layout-grid w-5 h-5 text-indigo-600 dark:text-indigo-400"
                >
                  <title>Kaneo Logo</title>
                  <rect width="7" height="7" x="3" y="3" rx="1" />
                  <rect width="7" height="7" x="14" y="3" rx="1" />
                  <rect width="7" height="7" x="14" y="14" rx="1" />
                  <rect width="7" height="7" x="3" y="14" rx="1" />
                </svg>
              </div>
              <span className="text-zinc-900 dark:text-white font-medium text-xl">
                Kaneo
              </span>
            </div>
            <p className="mt-4 text-zinc-600 dark:text-zinc-400 text-sm">
              Built with <Heart className="inline-block h-3 w-3 text-red-500" />{" "}
              in <span className="inline-flex items-center">🇲🇰</span>
            </p>
          </div>

          {/* Product links */}
          <div>
            <h3 className="text-zinc-900 dark:text-white font-medium mb-4">
              Product
            </h3>
            <ul className="space-y-3">
              <li>
                <Link
                  href="/docs"
                  className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white transition-colors text-sm flex items-center"
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Documentation
                </Link>
              </li>
              <li>
                <a
                  href="https://github.com/usekaneo/kaneo"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white transition-colors text-sm flex items-center"
                >
                  <Github className="h-4 w-4 mr-2" />
                  GitHub
                </a>
              </li>
              <li>
                <a
                  href="https://demo.kaneo.app"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white transition-colors text-sm flex items-center"
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Demo
                </a>
              </li>
            </ul>
          </div>

          {/* Community links */}
          <div>
            <h3 className="text-zinc-900 dark:text-white font-medium mb-4">
              Community
            </h3>
            <ul className="space-y-3">
              <li>
                <a
                  href="https://x.com/usekaneo"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white transition-colors text-sm flex items-center"
                >
                  <Twitter className="h-4 w-4 mr-2" />
                  Twitter
                </a>
              </li>
              <li>
                <a
                  href="https://discord.gg/rU4tSyhXXU"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white transition-colors text-sm flex items-center"
                >
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Discord
                </a>
              </li>
              <li>
                <a
                  href="https://github.com/orgs/usekaneo/discussions"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white transition-colors text-sm flex items-center"
                >
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Discussions
                </a>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </footer>
  );
}
