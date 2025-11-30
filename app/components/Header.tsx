import { blogConfig } from "../config";

export function Header() {
  return (
    <header className="mb-10 border-b border-black/5 dark:border-white/10 pb-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-black dark:text-white">
            {blogConfig.name}
          </h1>
          <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
            {blogConfig.tagline}
          </p>
        </div>
      </div>
      <p className="mt-4 max-w-2xl text-sm text-neutral-700 dark:text-neutral-300">
        {blogConfig.aboutMe}
      </p>
      <nav className="mt-4 flex flex-wrap gap-3 text-sm">
        {Object.entries(blogConfig.socialLinks).map(([key, url]) => {
          if (!url) return null;
          return (
            <a
              key={key}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full border border-neutral-300 px-3 py-1 text-neutral-700 transition hover:border-neutral-900 hover:text-neutral-900 dark:border-neutral-700 dark:text-neutral-300 dark:hover:border-neutral-100 dark:hover:text-neutral-100"
            >
              {key}
            </a>
          );
        })}
      </nav>
    </header>
  );
}


