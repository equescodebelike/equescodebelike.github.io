import fs from "fs";
import path from "path";
import type { TelegramPost } from "../types";

export function getPosts(): TelegramPost[] {
  try {
    const filePath = path.join(process.cwd(), "data", "posts.json");
    if (!fs.existsSync(filePath)) {
      return [];
    }
    const raw = fs.readFileSync(filePath, "utf8");
    if (!raw.trim()) return [];
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) return [];

    return data
      .filter((item) => item && typeof item.id !== "undefined")
      .sort((a, b) => b.date - a.date);
  } catch (error) {
    console.error("Failed to read posts.json:", error);
    return [];
  }
}


