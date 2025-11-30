import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPosts } from "../../lib/posts";
import { createSlug, extractIdFromSlug, getPostTitle } from "../../lib/slug";
import { normalizePostHtml, extractPlainText } from "../../lib/html";

const siteUrl = "https://equescodebelike.github.io/core";

export const dynamicParams = false;

export function generateStaticParams() {
  const posts = getPosts();
  return posts.map((post) => ({ slug: createSlug(post) }));
}

interface PageParams {
  slug: string;
}

interface PageProps {
  params: Promise<PageParams>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;

  const posts = getPosts();
  const id = extractIdFromSlug(slug);
  const post = posts.find((p) => p.id === id);

  if (!post) {
    return {
      title: "Пост не найден",
    };
  }

  const title = getPostTitle(post);
  const plain = extractPlainText(post.text || "");
  const description = plain.slice(0, 160);
  const url = `${siteUrl}/post/${slug}`;
  const ogImage = post.media ? `${siteUrl}${post.media}` : undefined;

  return {
    title,
    description,
    alternates: {
      canonical: url,
    },
    openGraph: {
      title,
      description,
      url,
      type: "article",
      siteName: "Core Blog",
      images: ogImage ? [{ url: ogImage }] : undefined,
    },
    twitter: {
      card: ogImage ? "summary_large_image" : "summary",
      title,
      description,
      images: ogImage ? [ogImage] : undefined,
    },
  };
}

export default async function PostPage({ params }: PageProps) {
  const { slug } = await params;

  const posts = getPosts();
  const id = extractIdFromSlug(slug);
  const post = posts.find((p) => p.id === id);

  if (!post) {
    notFound();
  }

  const title = getPostTitle(post!);
  const html = normalizePostHtml(post!.text || "");

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: title,
    datePublished: post!.dateFormatted,
    mainEntityOfPage: `${siteUrl}/post/${slug}`,
    image: post!.media ? [`${siteUrl}${post!.media}`] : undefined,
    author: {
      "@type": "Person",
      name: "Core Blog Author",
    },
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-neutral-50 to-neutral-100 px-4 py-8 font-sans text-neutral-900 dark:from-black dark:to-neutral-950 dark:text-neutral-50">
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <Link
          href="/"
          className="text-sm text-neutral-600 underline decoration-neutral-400 underline-offset-4 hover:decoration-neutral-900 dark:text-neutral-300 dark:hover:decoration-neutral-100"
        >
          ← Все посты
        </Link>

        <article>
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
            {title}
          </h1>
          <time className="mt-2 block text-xs uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
            {new Date(post!.dateFormatted).toLocaleString("ru-RU", {
              year: "numeric",
              month: "long",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </time>

          <div
            className="post-body mt-6 text-sm leading-relaxed text-neutral-900 dark:text-neutral-100"
            dangerouslySetInnerHTML={{ __html: html.trim() }}
          />
        </article>

        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </main>
    </div>
  );
}


