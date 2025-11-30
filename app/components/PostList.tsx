"use client";

import type { TelegramPost } from "../types";
import { createSlug } from "../lib/slug";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

interface PostListProps {
  posts: TelegramPost[];
}

export function PostList({ posts }: PostListProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const tag = searchParams.get("tag");

  const normalizedTag = tag?.toLowerCase().trim();

  const filteredPosts =
    normalizedTag && normalizedTag.length > 0
      ? posts.filter((post) =>
          (post.text || "")
            .toLowerCase()
            .includes(`#${normalizedTag}`),
        )
      : posts;

  return (
    <div className="flex flex-col gap-4">
      {normalizedTag && (
        <div className="mb-2 flex items-center justify-between rounded-xl border border-dashed border-neutral-300 bg-white/70 px-4 py-3 text-xs text-neutral-600 dark:border-neutral-700 dark:bg-neutral-950/60 dark:text-neutral-300">
          <div>
            Фильтр по тегу:{" "}
            <span className="font-semibold text-neutral-900 dark:text-neutral-50">
              #{normalizedTag}
            </span>
          </div>
          <Link
            href="/"
            className="rounded-full border border-neutral-300 px-3 py-1 text-neutral-700 transition hover:border-neutral-900 hover:text-neutral-900 dark:border-neutral-600 dark:text-neutral-200 dark:hover:border-neutral-100 dark:hover:text-neutral-100"
          >
            Сбросить
          </Link>
        </div>
      )}

      {filteredPosts.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-neutral-300 bg-white/60 px-4 py-6 text-sm text-neutral-500 backdrop-blur dark:border-neutral-700 dark:bg-neutral-950/40 dark:text-neutral-400">
          Постов с таким тегом пока нет.
        </p>
      ) : (
        filteredPosts.map((post) => {
          const slug = createSlug(post);
          return (
            <div
              key={post.id}
              className="block cursor-pointer"
              onClick={(event) => {
                const target = event.target as HTMLElement;
                // Если клик по ссылке внутри поста (тег, обычный линк) — даём ей отработать
                if (target.closest("a")) return;
                router.push(`/post/${slug}`);
              }}
            >
              {/* PostCard — серверный компонент, но его можно использовать в клиентском через JSX */}
              <PostCardFromClient post={post} />
            </div>
          );
        })
      )}
    </div>
  );
}

// Обёртка над серверным PostCard для использования в клиентском компоненте
// (Next автоматически разрулит этот градиент).
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { PostCard: PostCardFromClient } = require("./PostCard");


