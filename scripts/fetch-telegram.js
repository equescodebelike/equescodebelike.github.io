/*
  Скрипт для получения постов из Telegram-канала и записи их в data/posts.json

  Использование:
    TELEGRAM_BOT_TOKEN=xxxxx node scripts/fetch-telegram.js

  В GitHub Actions токен должен передаваться через secrets:
    env:
      TELEGRAM_BOT_TOKEN: ${{ secrets.TELEGRAM_BOT_TOKEN }}

  Важно:
    - Бот должен быть администратором канала (иначе channel_post не приходит).
    - Bot API хранит апдейты только 24 часа, поэтому запускать скрипт нужно
      чаще, чем раз в сутки.
    - Скачанные фото складываются в public/telegram/photos и должны
      коммититься в репозиторий вместе с data/posts.json.
*/

const fs = require("fs");
const path = require("path");

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHANNEL_USERNAME = "lemobilecore"; // без @

const MAX_UPDATE_PAGES = 10;
const UPDATES_PER_PAGE = 100;

if (!TELEGRAM_BOT_TOKEN) {
  console.error("TELEGRAM_BOT_TOKEN is not set");
  process.exit(1);
}

const API_URL = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;
const FILE_URL = `https://api.telegram.org/file/bot${TELEGRAM_BOT_TOKEN}`;
const PHOTOS_DIR = path.join(process.cwd(), "public", "telegram", "photos");

async function callApi(method, params) {
  const response = await fetch(`${API_URL}/${method}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(params || {}),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Telegram ${method} failed: ${response.status} ${text}`);
  }

  const data = await response.json();
  if (!data.ok) {
    throw new Error(`Telegram API error (${method}): ${JSON.stringify(data)}`);
  }

  return data.result;
}

async function fetchUpdates() {
  // Забираем все страницы апдейтов, сдвигая offset, чтобы не упереться
  // в лимит в 100 штук за один вызов.
  const updates = [];
  let offset = 0;

  for (let page = 0; page < MAX_UPDATE_PAGES; page += 1) {
    const batch = await callApi("getUpdates", {
      offset,
      limit: UPDATES_PER_PAGE,
      allowed_updates: ["channel_post", "edited_channel_post"],
    });

    if (!Array.isArray(batch) || batch.length === 0) break;

    updates.push(...batch);

    const lastUpdateId = batch[batch.length - 1].update_id;
    offset = lastUpdateId + 1;

    if (batch.length < UPDATES_PER_PAGE) break;
  }

  console.log(`Received ${updates.length} update(s) from Telegram`);
  return updates;
}

function escapeHtml(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function entityTag(entity, text) {
  switch (entity.type) {
    case "bold":
      return { open: "<b>", close: "</b>" };
    case "italic":
      return { open: "<i>", close: "</i>" };
    case "underline":
      return { open: "<u>", close: "</u>" };
    case "strikethrough":
      return { open: "<s>", close: "</s>" };
    case "code":
      return { open: "<code>", close: "</code>" };
    case "pre":
      return { open: "<pre>", close: "</pre>" };
    case "spoiler":
      return { open: '<span class="tg-spoiler">', close: "</span>" };
    case "blockquote":
    case "expandable_blockquote":
      return { open: "<blockquote>", close: "</blockquote>" };
    case "text_link": {
      const href = entity.url ? ` href="${escapeHtml(entity.url)}"` : "";
      return { open: `<a${href}>`, close: "</a>" };
    }
    case "url": {
      const url = text.slice(entity.offset, entity.offset + entity.length);
      return { open: `<a href="${escapeHtml(url)}">`, close: "</a>" };
    }
    case "mention": {
      const mention = text.slice(entity.offset, entity.offset + entity.length);
      return {
        open: `<a href="https://t.me/${escapeHtml(mention.replace(/^@/, ""))}">`,
        close: "</a>",
      };
    }
    case "hashtag": {
      const hashtag = text.slice(entity.offset, entity.offset + entity.length);
      return {
        open: `<a href="https://t.me/${TELEGRAM_CHANNEL_USERNAME}?q=${encodeURIComponent(
          hashtag,
        )}">`,
        close: "</a>",
      };
    }
    default:
      return null;
  }
}

function buildTextHtml(text, entities) {
  if (!text) return "";

  const events = [];

  for (const entity of entities || []) {
    const tag = entityTag(entity, text);
    if (!tag) continue;

    const start = entity.offset;
    const end = entity.offset + entity.length;
    if (start < 0 || end > text.length || start >= end) continue;

    events.push({ pos: start, type: "open", start, end, tag: tag.open });
    events.push({ pos: end, type: "close", start, end, tag: tag.close });
  }

  events.sort((a, b) => {
    if (a.pos !== b.pos) return a.pos - b.pos;
    if (a.type !== b.type) return a.type === "close" ? -1 : 1;
    // На одной позиции сначала закрываем внутренние теги, затем открываем внешние.
    if (a.type === "close") return b.start - a.start;
    return b.end - a.end;
  });

  let html = "";
  let cursor = 0;

  for (const event of events) {
    if (event.pos > cursor) {
      html += escapeHtml(text.slice(cursor, event.pos));
      cursor = event.pos;
    }
    html += event.tag;
  }

  if (cursor < text.length) {
    html += escapeHtml(text.slice(cursor));
  }

  return html.replace(/\n/g, "<br/>");
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

async function downloadFile(fileId, destBase) {
  try {
    const file = await callApi("getFile", { file_id: fileId });
    if (!file || !file.file_path) return null;

    const ext = path.extname(file.file_path) || "";
    const destPath = `${destBase}${ext}`;
    const publicPath = `/telegram/photos/${path.basename(destPath)}`;

    ensureDir(PHOTOS_DIR);

    if (fs.existsSync(destPath)) {
      return publicPath;
    }

    const response = await fetch(`${FILE_URL}/${file.file_path}`);
    if (!response.ok) {
      throw new Error(`download failed: ${response.status}`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    fs.writeFileSync(destPath, buffer);
    console.log(`Downloaded media: ${publicPath} (${buffer.length} bytes)`);

    return publicPath;
  } catch (error) {
    console.warn(`Failed to download media ${fileId}:`, error.message);
    return null;
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

function pickMedia(message) {
  if (Array.isArray(message.photo) && message.photo.length > 0) {
    return { type: "photo", item: message.photo[message.photo.length - 1] };
  }
  if (message.video) return { type: "video", item: message.video };
  if (message.animation) return { type: "animation", item: message.animation };
  if (message.document) return { type: "document", item: message.document };
  return null;
}

async function mapMessageToPost(message) {
  const rawText = message.text || message.caption || "";
  const entities = message.entities || message.caption_entities || [];
  const textHtml = buildTextHtml(rawText, entities);

  const picked = pickMedia(message);
  let mediaType = null;
  let mediaPath = null;
  const imagePaths = [];

  if (picked) {
    mediaType = picked.type;
    const destBase = path.join(
      PHOTOS_DIR,
      `tg_${message.message_id}`,
    );
    const downloaded = await downloadFile(picked.item.file_id, destBase);
    if (downloaded) {
      mediaPath = downloaded;
      if (mediaType === "photo") {
        imagePaths.push(downloaded);
      }
    }
  }

  return {
    id: message.message_id,
    date: message.date,
    dateFormatted: new Date(message.date * 1000).toISOString(),
    text: `${buildImageHtml(imagePaths)}${textHtml}`,
    mediaType,
    media: mediaPath,
  };
}

function readExistingPosts() {
  const filePath = path.join(process.cwd(), "data", "posts.json");
  try {
    if (!fs.existsSync(filePath)) {
      return [];
    }
    const raw = fs.readFileSync(filePath, "utf8");
    if (!raw.trim()) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.warn("Failed to read existing posts.json, starting fresh:", e.message);
    return [];
  }
}

function writePosts(posts) {
  const filePath = path.join(process.cwd(), "data", "posts.json");
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(filePath, JSON.stringify(posts, null, 2), "utf8");
  console.log(`Saved ${posts.length} posts to data/posts.json`);
}

async function main() {
  console.log("Fetching Telegram channel posts...");
  const updates = await fetchUpdates();

  const channelMessages = [];

  for (const update of updates) {
    const message =
      update.channel_post || update.edited_channel_post || update.message;
    if (!message) continue;

    if (!message.chat || message.chat.type !== "channel") continue;

    if (
      message.chat.username &&
      message.chat.username.toLowerCase() !==
        TELEGRAM_CHANNEL_USERNAME.toLowerCase()
    ) {
      continue;
    }

    channelMessages.push(message);
  }

  console.log(`Matched ${channelMessages.length} channel post(s)`);

  const mapped = [];
  for (const message of channelMessages) {
    mapped.push(await mapMessageToPost(message));
  }

  // Мёрджим с уже существующими постами, чтобы не терять историю
  const existing = readExistingPosts();
  const byId = new Map();

  for (const post of existing) {
    if (post && typeof post.id !== "undefined") {
      byId.set(post.id, post);
    }
  }

  let added = 0;
  for (const post of mapped) {
    if (!byId.has(post.id)) added += 1;
    byId.set(post.id, post);
  }

  const merged = Array.from(byId.values()).sort((a, b) => b.date - a.date);

  // Ограничим, чтобы файл не рос бесконечно (например, последние 200 постов)
  const limited = merged.slice(0, 200);

  console.log(`New posts: ${added}`);
  writePosts(limited);
}

main().catch((err) => {
  console.error("Error while fetching Telegram posts:", err);
  process.exit(1);
});
