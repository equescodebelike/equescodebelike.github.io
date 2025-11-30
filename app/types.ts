export type MediaType = "photo" | "video" | "document" | "animation" | null;

export interface TelegramPost {
  id: number;
  date: number;
  dateFormatted: string;
  text: string;
  mediaType: MediaType;
  media: string | null;
}

export interface SocialLinks {
  telegram?: string;
  github?: string;
  twitter?: string;
  instagram?: string;
  [key: string]: string | undefined;
}

export interface BlogConfig {
  name: string;
  tagline: string;
  aboutMe: string;
  socialLinks: SocialLinks;
}


