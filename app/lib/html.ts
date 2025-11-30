export function normalizePostHtml(html: string): string {
  if (!html) return "";
  let result = html;

  // Превращаем телеграмовские хэштеги в ссылки с фильтром по тегу
  // Пример исходника:
  // <a href="" onclick="return ShowHashtag(&quot;ru&quot;)">#ru</a>
  result = result.replace(
    /<a href="" onclick="return ShowHashtag\(&quot;([^"]+)&quot;\)">/g,
    (_match, tag) => `<a href="/?tag=${encodeURIComponent(tag)}">`,
  );

  // На всякий случай убираем оставшиеся inline onclick, чтобы не было мусора
  result = result.replace(/\sonclick="[^"]*"/g, "");

  return result;
}

export function buildPreviewHtml(html: string): string {
  if (!html) return "";

  const matchImg = html.match(/<img[^>]*>/i);
  const firstImgTag = matchImg ? matchImg[0] : "";

  // Удаляем все <img> из остального HTML
  const withoutImgs = html.replace(/<img[^>]*>/gi, "");

  if (!firstImgTag) {
    return withoutImgs;
  }

  return `${firstImgTag}<br/>${withoutImgs}`;
}

export function extractPlainText(html: string): string {
  if (!html) return "";
  // Удаляем теги
  let text = html.replace(/<[^>]+>/g, " ");
  // Декодируем несколько базовых сущностей
  text = text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
  // Нормализуем пробелы
  return text.replace(/\s+/g, " ").trim();
}


