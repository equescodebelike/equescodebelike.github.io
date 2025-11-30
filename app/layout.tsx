import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { blogConfig } from "./config";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteUrl = "https://equescodebelike.github.io/core";

export const metadata: Metadata = {
  title: `${blogConfig.name} — ${blogConfig.tagline}`,
  description: blogConfig.aboutMe,
  metadataBase: new URL(siteUrl),
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: `${blogConfig.name} — ${blogConfig.tagline}`,
    description: blogConfig.aboutMe,
    url: siteUrl,
    siteName: blogConfig.name,
    locale: "ru_RU",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: `${blogConfig.name} — ${blogConfig.tagline}`,
    description: blogConfig.aboutMe,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: "Core Blog Author",
    url: siteUrl,
    sameAs: Object.values(blogConfig.socialLinks).filter(Boolean),
    description: blogConfig.aboutMe,
  };

  return (
    <html lang="ru">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        {children}
      </body>
    </html>
  );
}
