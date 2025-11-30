import { Header } from "./components/Header";
import { getPosts } from "./lib/posts";
import { PostList } from "./components/PostList";

export default function Home() {
  const posts = getPosts();

  return (
    <div className="min-h-screen bg-gradient-to-b from-neutral-50 to-neutral-100 px-4 py-8 font-sans text-neutral-900 dark:from-black dark:to-neutral-950 dark:text-neutral-50">
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-8">
        <Header />

        {posts.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-neutral-300 bg-white/60 px-4 py-6 text-sm text-neutral-500 backdrop-blur dark:border-neutral-700 dark:bg-neutral-950/40 dark:text-neutral-400">
            Пока нет постов. Они появятся здесь после первого импорта из Telegram
            канала{" "}
            <a
              href="https://t.me/lemobilecore"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-neutral-800 underline decoration-neutral-400 hover:decoration-neutral-800 dark:text-neutral-100"
            >
              @lemobilecore
            </a>
            .
          </p>
        ) : (
          <PostList posts={posts} />
        )}
      </main>
    </div>
  );
}
