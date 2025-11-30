/* 
  Скрипт для получения постов из Telegram-канала и записи их в data/posts.json

  Использование:
    TELEGRAM_BOT_TOKEN=xxxxx node scripts/fetch-telegram.js

  В GitHub Actions токен должен передаваться через secrets:
    env:
      TELEGRAM_BOT_TOKEN: ${{ secrets.TELEGRAM_BOT_TOKEN }}
*/

const fs = require("fs");
const path = require("path");

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHANNEL_USERNAME = "lemobilecore"; // без @

if (!TELEGRAM_BOT_TOKEN) {
  console.error("TELEGRAM_BOT_TOKEN is not set");
  process.exit(1);
}

const API_URL = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

async function fetchUpdates() {
  const response = await fetch(`${API_URL}/getUpdates`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      allowed_updates: ["channel_post"],
      limit: 100,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Telegram getUpdates failed: ${response.status} ${text}`);
  }

  const data = await response.json();
  if (!data.ok) {
    throw new Error(`Telegram API error: ${JSON.stringify(data)}`);
  }

  return Array.isArray(data.result) ? data.result : [];
}

function extractText(message) {
  // В Bot API текст в channel_post обычно строка, caption — тоже строка
  return message.text || message.caption || "";
}

function mapMessageToPost(message) {
  let mediaType = null;
  let media = null;

  if (Array.isArray(message.photo) && message.photo.length > 0) {
    mediaType = "photo";
    // Берём самый большой размер (последний элемент)
    media = message.photo[message.photo.length - 1].file_id;
  } else if (message.video) {
    mediaType = "video";
    media = message.video.file_id;
  } else if (message.document) {
    mediaType = "document";
    media = message.document.file_id;
  } else if (message.animation) {
    mediaType = "animation";
    media = message.animation.file_id;
  }

  return {
    id: message.message_id,
    date: message.date,
    dateFormatted: new Date(message.date * 1000).toISOString(),
    text: extractText(message),
    mediaType,
    media,
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
    const message = update.channel_post || update.message;
    if (!message) continue;

    // Только сообщения канала
    if (!message.chat || message.chat.type !== "channel") continue;
    if (message.chat.username && message.chat.username.toLowerCase() !== TELEGRAM_CHANNEL_USERNAME.toLowerCase()) {
      continue;
    }

    // Пропускаем сервисные/служебные
    if (message.service_message) continue;

    channelMessages.push(message);
  }

  const mapped = channelMessages.map(mapMessageToPost);

  // Мёрджим с уже существующими постами, чтобы не терять историю
  const existing = readExistingPosts();
  const byId = new Map();

  for (const post of existing) {
    if (post && typeof post.id !== "undefined") {
      byId.set(post.id, post);
    }
  }

  for (const post of mapped) {
    byId.set(post.id, post);
  }

  const merged = Array.from(byId.values()).sort((a, b) => b.date - a.date);

  // Ограничим, чтобы файл не рос бесконечно (например, последние 200 постов)
  const limited = merged.slice(0, 200);

  writePosts(limited);
}

main().catch((err) => {
  console.error("Error while fetching Telegram posts:", err);
  process.exit(1);
});


