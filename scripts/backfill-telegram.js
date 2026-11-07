/*
  Бэкфилл постов из публичного превью Telegram-канала в data/posts.json

  Зачем нужен:
    Bot API (scripts/fetch-telegram.js) отдаёт апдейты только за последние
    24 часа и не умеет возвращать историю. Если бот/воркфлоу был выключен,
    пропущенные посты этим скриптом можно достать из публичной веб-версии
    канала (t.me/s/<username>).

  Использование:
    node scripts/backfill-telegram.js

  Что делает:
    - Идёт по страницам t.me/s/lemobilecore (пагинация через ?before=),
      пока не дойдёт до постов, которые уже есть в data/posts.json.
    - Скачивает фото в public/telegram/photos/*.
    - Добавляет только отсутствующие посты (существующие не перезаписывает).
    - Пропускает видео, репосты (forward), голосования и служебные сообщения.
      Если такие посты уже есть в data/posts.json — удаляет их.

  Ограничения:
    - Работает только для публичных каналов.
    - Это неофициальный парсинг HTML, вёрстка t.me может измениться.
*/

const fs = require("fs");
const path = require("path");

const CHANNEL_USERNAME = "lemobilecore";
const BASE_URL = `https://t.me/s/${CHANNEL_USERNAME}`;
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/124.0 Safari/537.36";

const MAX_PAGES = 20;
const PHOTOS_DIR = path.join(process.cwd(), "public", "telegram", "photos");
const POSTS_PATH = path.join(process.cwd(), "data", "posts.json");

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

async function fetchHtml(url, attempt = 1) {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
        "Accept-Language": "ru,en;q=0.9",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return await response.text();
  } catch (error) {
    if (attempt < 3) {
      console.warn(`Fetch failed (${error.message}), retrying ${url}`);
      return fetchHtml(url, attempt + 1);
    }
    throw error;
  }
}

function readExistingPosts() {
  try {
    if (!fs.existsSync(POSTS_PATH)) return [];
    const raw = fs.readFileSync(POSTS_PATH, "utf8");
    if (!raw.trim()) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.warn("Failed to read posts.json:", error.message);
    return [];
  }
}

function buildImageHtml(paths) {
  if (!paths.length) return "";

  return (
    paths
      .map(
        (src) =>
          `<img src="${src}" alt="" class="mb-3 rounded-2xl border border-black/5 dark:border-white/10 max-w-full h-auto" />`,
      )
      .join("") + "<br/>"
  );
}

function stripTags(html) {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function parseMessage(block) {
  const idMatch = block.match(/data-post="[^/]+\/(\d+)"/);
  if (!idMatch) return null;
  const id = Number(idMatch[1]);

  const dateMatch = block.match(
    /<a class="tgme_widget_message_date"[^>]*href="[^"]*"><time datetime="([^"]+)"/,
  );
  if (!dateMatch) return null;
  const date = Math.floor(new Date(dateMatch[1]).getTime() / 1000);

  const textMatch = block.match(
    /<div class="tgme_widget_message_text[^"]*"[^>]*>([\s\S]*?)<\/div>/,
  );
  const textHtml = textMatch ? textMatch[1].trim() : "";

  const imageUrls = [
    ...block.matchAll(
      /<a class="tgme_widget_message_photo_wrap[^"]*"[^>]*style="[^"]*background-image:url\('([^']+)'\)/g,
    ),
  ].map((match) => match[1]);

  const thumbMatch = block.match(
    /<i class="tgme_widget_message_(?:video|roundvideo)_thumb"[^>]*style="[^"]*background-image:url\('([^']+)'\)/,
  );
  const thumbUrl = thumbMatch ? thumbMatch[1] : null;
  const hasVideo =
    /<video\b/.test(block) ||
    block.includes("tgme_widget_message_video") ||
    block.includes("tgme_widget_message_roundvideo");
  const isService = block.includes("service_message");

  const pollQuestion = block.match(
    /<div class="tgme_widget_message_poll_question[^"]*"[^>]*>([\s\S]*?)<\/div>/,
  );
  const pollOptions = [
    ...block.matchAll(
      /<div class="tgme_widget_message_poll_option_text[^"]*"[^>]*>([\s\S]*?)<\/div>/g,
    ),
  ].map((match) => stripTags(match[1]));

  const forwardedMatch = block.match(
    /tgme_widget_message_forwarded_from_name" href="([^"]+)"[^>]*><span[^>]*>([\s\S]*?)<\/span>/,
  );
  const isForwarded = /tgme_widget_message_forwarded_from/.test(block);

  return {
    id,
    date,
    text: textHtml,
    imageUrls,
    thumbUrl,
    hasVideo,
    isService,
    isForwarded,
    isPoll: Boolean(pollQuestion && pollOptions.length),
    poll:
      pollQuestion && pollOptions.length
        ? { question: stripTags(pollQuestion[1]), options: pollOptions }
        : null,
    forwardedFrom: forwardedMatch
      ? { url: forwardedMatch[1], name: stripTags(forwardedMatch[2]) }
      : null,
  };
}

function parseMessages(html) {
  return html
    .split('<div class="tgme_widget_message ')
    .slice(1)
    .map((part) => parseMessage(`<div class="tgme_widget_message ${part}`))
    .filter(Boolean);
}

async function downloadImage(url, fileName) {
  ensureDir(PHOTOS_DIR);
  const destPath = path.join(PHOTOS_DIR, fileName);
  const publicPath = `/telegram/photos/${fileName}`;

  if (fs.existsSync(destPath)) {
    return publicPath;
  }

  const response = await fetch(url, {
    headers: { "User-Agent": USER_AGENT },
  });

  if (!response.ok) {
    console.warn(`Failed to download ${url}: HTTP ${response.status}`);
    return null;
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  fs.writeFileSync(destPath, buffer);
  console.log(`Downloaded ${publicPath} (${buffer.length} bytes)`);

  return publicPath;
}

function imageExtension(url) {
  try {
    const ext = path.extname(new URL(url).pathname);
    return ext && ext.length <= 5 ? ext : ".jpg";
  } catch {
    return ".jpg";
  }
}

async function buildPost(message) {
  const id = message.id;
  const images = [];

  for (let index = 0; index < message.imageUrls.length; index += 1) {
    const url = message.imageUrls[index];
    const ext = imageExtension(url);
    const downloaded = await downloadImage(url, `tg_${id}_${index}${ext}`);
    if (downloaded) images.push(downloaded);
  }

  if (!images.length && message.thumbUrl) {
    const ext = imageExtension(message.thumbUrl);
    const downloaded = await downloadImage(message.thumbUrl, `tg_${id}_thumb${ext}`);
    if (downloaded) images.push(downloaded);
  }

  let text = message.text;

  if (!text && !images.length) {
    text = `<a href="https://t.me/${CHANNEL_USERNAME}/${id}">Открыть пост в Telegram</a>`;
  }

  return {
    id,
    date: message.date,
    dateFormatted: new Date(message.date * 1000).toISOString(),
    text: `${buildImageHtml(images)}${text}`,
    mediaType: images.length ? "photo" : null,
    media: images.length ? images[0] : null,
  };
}

async function main() {
  const existing = readExistingPosts();
  const byId = new Map();
  for (const post of existing) {
    if (post && typeof post.id !== "undefined") byId.set(post.id, post);
  }

  const maxExistingId = existing.reduce(
    (max, post) => Math.max(max, Number(post.id) || 0),
    0,
  );

  console.log(
    `Existing posts: ${existing.length} (max id: ${maxExistingId || "none"})`,
  );

  const seenIds = new Set();
  const seenImageUrls = new Set();
  const scraped = [];
  let url = BASE_URL;

  for (let page = 0; page < MAX_PAGES; page += 1) {
    console.log(`Fetching ${url}`);
    const html = await fetchHtml(url);
    const messages = parseMessages(html);

    if (!messages.length) break;

    const fresh = messages.filter((message) => !seenIds.has(message.id));
    if (!fresh.length) break;

    for (const message of fresh) {
      seenIds.add(message.id);
      // В веб-превью элементы медиа-группы идут отдельными сообщениями и
      // могут повторять картинку предыдущего поста. Такие дубли пропускаем.
      message.isDuplicateMedia =
        !message.text &&
        message.imageUrls.length > 0 &&
        message.imageUrls.every((imageUrl) => seenImageUrls.has(imageUrl));
      for (const imageUrl of message.imageUrls) {
        seenImageUrls.add(imageUrl);
      }
      scraped.push(message);
    }

    const minId = Math.min(...messages.map((message) => message.id));
    // Дошли до уже импортированной истории — дальше листать не нужно.
    if (maxExistingId && minId <= maxExistingId) break;

    url = `${BASE_URL}?before=${minId}`;
  }

  // Посты с видео, репосты, голосования и служебные сообщения не импортируем.
  const isExcluded = (message) =>
    message.hasVideo ||
    message.isPoll ||
    message.isForwarded ||
    message.isService ||
    message.isDuplicateMedia;

  // Заодно вычищаем такие посты, если они уже успели попасть в posts.json
  // (в пределах просмотренных страниц).
  let removed = 0;
  for (const message of scraped) {
    if (isExcluded(message) && byId.has(message.id)) {
      byId.delete(message.id);
      removed += 1;
      console.log(`Removed excluded post #${message.id}`);
    }
  }

  const missing = scraped.filter((message) => !byId.has(message.id));
  const excluded = missing.filter(isExcluded);
  const allowed = missing.filter((message) => !isExcluded(message)).sort(
    (a, b) => a.id - b.id,
  );

  console.log(
    `Scraped ${scraped.length} message(s), missing: ${missing.length}, ` +
      `excluded: ${excluded.length}, to add: ${allowed.length}`,
  );

  if (excluded.length) {
    console.log(
      `Skipped ids: ${excluded.map((message) => message.id).join(", ")}`,
    );
  }

  let added = 0;
  for (const message of allowed) {
    const post = await buildPost(message);
    byId.set(post.id, post);
    added += 1;
    console.log(`Added post #${post.id} (${post.dateFormatted})`);
  }

  const posts = Array.from(byId.values()).sort((a, b) => b.date - a.date);

  ensureDir(path.dirname(POSTS_PATH));
  fs.writeFileSync(POSTS_PATH, JSON.stringify(posts, null, 2), "utf8");

  console.log(
    `Done. Added ${added} post(s), removed ${removed} excluded post(s), total ${posts.length}.`,
  );
}

main().catch((error) => {
  console.error("Backfill failed:", error);
  process.exit(1);
});
