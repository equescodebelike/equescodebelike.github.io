import type { TelegramPost } from "../types";
import { extractPlainText } from "./html";

export function getPostTitle(post: TelegramPost): string {
  // Пытаемся вытащить заголовок из первого <strong>...</strong>,
  // но всегда очищаем от HTML и сущностей, чтобы не было <br>, &apos; и т.п.
  const strongMatch = post.text.match(/<strong>([\s\S]*?)<\/strong>/i);
  const source = strongMatch ? strongMatch[1] : post.text;
  const plain = extractPlainText(source || "");

  return plain.trim().replace(/\s+/g, " ").slice(0, 80) || "Пост";
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9а-яё\s-]/gi, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

export function createSlug(post: TelegramPost): string {
  // По запросу: используем только id в качестве слага
  return String(post.id);
}

export function extractIdFromSlug(slug: string): number | null {
  if (!slug) return null;
  const id = Number(slug);
  return Number.isFinite(id) ? id : null;
}


