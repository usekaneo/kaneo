import { Cloud, Kanban, Lock } from "lucide-react";

const features = [
  {
    name: "Visual Task Management",
    description:
      "Organize tasks with our intuitive kanban board interface. Drag and drop tasks, set priorities, and track progress.",
    icon: Kanban,
  },
  {
    name: "Self-hosted & Secure",
    description:
      "Deploy on your own infrastructure with complete control over your data and customization options.",
    icon: Cloud,
  },
  {
    name: "Data Privacy",
    description:
      "Built with security in mind. Your data stays private and protected with robust security measures.",
    icon: Lock,
  },
];

export default function Features() {
  return (
    <div className="py-16 bg-white dark:bg-zinc-950" id="features">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto">
          <h2 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-white sm:text-4xl animate-fade-in">
            Simple yet powerful
          </h2>
          <p className="mt-4 text-lg text-zinc-600 dark:text-zinc-400 animate-fade-in-delay">
            Focus on what matters with our essential features
          </p>
        </div>

        <div className="mt-16 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature, index) => (
            <div
              key={feature.name}
              className={`feature-item relative animate-fade-in-up-${index}`}
            >
              <div className="relative rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-8 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors duration-100">
                <div className="inline-flex p-3 rounded-lg bg-indigo-50 dark:bg-indigo-500/10">
                  <feature.icon className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
                </div>
                <h3 className="mt-6 text-lg font-semibold text-zinc-900 dark:text-white">
                  {feature.name}
                </h3>
                <p className="mt-2 text-zinc-600 dark:text-zinc-400">
                  {feature.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
