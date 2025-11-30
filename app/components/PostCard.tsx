import type { TelegramPost } from "../types";
import { normalizePostHtml, buildPreviewHtml } from "../lib/html";

interface PostCardProps {
  post: TelegramPost;
}

function formatDate(iso: string) {
  const date = new Date(iso);
  return date.toLocaleString("ru-RU", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function PostCard({ post }: PostCardProps) {
  const hasMedia = Boolean(post.media && post.mediaType);
  const fullHtml = normalizePostHtml(post.text || "");
  const html = buildPreviewHtml(fullHtml);

  return (
    <article className="rounded-2xl border border-black/5 bg-white/80 p-5 shadow-sm shadow-black/5 backdrop-blur dark:border-white/10 dark:bg-neutral-950/60 dark:shadow-black/40">
      <time className="text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
        {formatDate(post.dateFormatted)}
      </time>

      {html && (
        <div
          className="post-body post-preview mt-3 text-sm leading-relaxed text-neutral-900 dark:text-neutral-100"
          dangerouslySetInnerHTML={{
            __html: html.trim(),
          }}
        />
      )}

      {hasMedia && (
        <div className="mt-3 rounded-lg border border-dashed border-neutral-300 px-3 py-2 text-xs text-neutral-500 dark:border-neutral-700 dark:text-neutral-400">
          Медиа из Telegram:{" "}
          <span className="font-semibold">{post.mediaType}</span>{" "}
          <span className="break-all">({post.media})</span>
        </div>
      )}
    </article>
  );
}

