import type { MetadataRoute } from "next";
import { getPosts } from "./lib/posts";
import { createSlug } from "./lib/slug";

export const dynamic = "force-static";
export const revalidate = false;

const siteUrl = "https://equescodebelike.github.io";

export default function sitemap(): MetadataRoute.Sitemap {
  const posts = getPosts();

  const postEntries: MetadataRoute.Sitemap = posts.map((post) => ({
    url: `${siteUrl}/post/${createSlug(post)}`,
    lastModified: new Date(post.dateFormatted),
  }));

  return [
    {
      url: siteUrl,
      lastModified:
        postEntries[0]?.lastModified ?? new Date(),
    },
    ...postEntries,
  ];
}


