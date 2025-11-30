/*
  Импорт истории из Telegram HTML-экспорта в data/posts.json

  Использование (один раз локально):
    node scripts/import-chat-export.js

  Требования:
    - Папка экспорта Telegram: ChatExport_2025-11-30
    - Внутри неё: messages.html и папка photos/ с изображениями

  Результат:
    - Копирует все photos/* в public/telegram/photos/*
    - Создаёт/перезаписывает data/posts.json с постами в формате, который
      уже понимает фронтенд блога (text = HTML, внутри могут быть <img> и т.д.)
*/

const fs = require("fs");
const path = require("path");

const EXPORT_DIR = path.join(process.cwd(), "ChatExport_2025-11-30");
const MESSAGES_HTML = path.join(EXPORT_DIR, "messages.html");
const EXPORT_PHOTOS_DIR = path.join(EXPORT_DIR, "photos");
const PUBLIC_PHOTOS_DIR = path.join(
  process.cwd(),
  "public",
  "telegram",
  "photos",
);

function parseDateToTimestamp(dateTitle) {
  // Пример: "08.07.2025 22:36:48 UTC+03:00"
  const match = dateTitle.match(
    /^(\d{2})\.(\d{2})\.(\d{4}) (\d{2}):(\d{2}):(\d{2}) UTC([+-])(\d{2}):(\d{2})$/,
  );
  if (!match) {
    return Math.floor(Date.now() / 1000);
  }

  const [, dd, mm, yyyy, hh, min, ss, sign, offH, offM] = match;
  const day = Number(dd);
  const month = Number(mm) - 1;
  const year = Number(yyyy);
  const hour = Number(hh);
  const minute = Number(min);
  const second = Number(ss);
  const offsetMinutes = Number(offH) * 60 + Number(offM);
  const offsetMs =
    offsetMinutes * 60 * 1000 * (sign === "+" ? 1 : -1);

  // Создаём дату как будто это UTC-время, потом вычитаем оффсет
  const localAsUtc = Date.UTC(year, month, day, hour, minute, second);
  const utcMs = localAsUtc - offsetMs;
  return Math.floor(utcMs / 1000);
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function copyPhotosIfNeeded(imageHrefs) {
  ensureDir(PUBLIC_PHOTOS_DIR);
  const copied = new Set();

  for (const href of imageHrefs) {
    // href вида "photos/photo_3@08-07-2025_22-36-48.jpg"
    const fileName = path.basename(href);
    if (copied.has(fileName)) continue;
    copied.add(fileName);

    const srcPath = path.join(EXPORT_PHOTOS_DIR, fileName);
    const destPath = path.join(PUBLIC_PHOTOS_DIR, fileName);

    if (!fs.existsSync(srcPath)) {
      console.warn("Photo file not found, skip:", srcPath);
      continue;
    }

    fs.copyFileSync(srcPath, destPath);
  }
}

function buildImageHtml(imageHrefs) {
  if (!imageHrefs.length) return "";

  const imgs = imageHrefs
    .map((href) => {
      const fileName = path.basename(href);
      // Сайт теперь в корне GitHub Pages, достаточно /telegram/photos/...
      const src = `/telegram/photos/${fileName}`;
      return `<img src="${src}" alt="" class="mb-3 rounded-2xl border border-black/5 dark:border-white/10 max-w-full h-auto" />`;
    })
    .join("");

  return imgs + "<br/>";
}

function main() {
  if (!fs.existsSync(MESSAGES_HTML)) {
    console.error("messages.html not found at", MESSAGES_HTML);
    process.exit(1);
  }

  const html = fs.readFileSync(MESSAGES_HTML, "utf8");

  // Разбиваем по сообщениям
  const parts = html.split(
    '<div class="message default clearfix"',
  );
  parts.shift(); // до первого сообщения — мусор

  const posts = [];
  const allImageHrefs = [];

  for (const part of parts) {
    const block = '<div class="message default clearfix"' + part;

    const idMatch = block.match(/id="message(\d+)"/);
    if (!idMatch) continue;
    const id = Number(idMatch[1]);

    const dateMatch = block.match(
      /<div class="pull_right date details" title="([^"]+)"/,
    );
    if (!dateMatch) continue;
    const dateTitle = dateMatch[1];
    const timestamp = parseDateToTimestamp(dateTitle);

    const textMatch = block.match(
      /<div class="text">([\s\S]*?)<\/div>/,
    );
    const textHtml = textMatch ? textMatch[1].trim() : "";

    // Ищем все фото в media_wrap
    const mediaHrefMatches = [
      ...block.matchAll(
        /<a class="photo_wrap[^"]*" href="([^"]+)"/g,
      ),
    ];
    const imageHrefs = mediaHrefMatches.map((m) => m[1]);
    allImageHrefs.push(...imageHrefs);

    const imagesHtml = buildImageHtml(imageHrefs);
    const combinedHtml = `${imagesHtml}${textHtml}`;

    posts.push({
      id,
      date: timestamp,
      dateFormatted: new Date(timestamp * 1000).toISOString(),
      text: combinedHtml,
      mediaType: imageHrefs.length ? "photo" : null,
      media: imageHrefs.length
        ? `/telegram/photos/${path.basename(imageHrefs[0])}`
        : null,
    });
  }

  // Копируем все изображения в public/telegram/photos
  copyPhotosIfNeeded(allImageHrefs);

  // Сортируем по дате (новые сверху)
  posts.sort((a, b) => b.date - a.date);

  const outPath = path.join(process.cwd(), "data", "posts.json");
  ensureDir(path.dirname(outPath));
  fs.writeFileSync(outPath, JSON.stringify(posts, null, 2), "utf8");

  console.log(`Imported ${posts.length} posts to data/posts.json`);
}

main();


