import type { Metadata } from "next";

export const SITE_NAME = "Nexus Codex";
export const DEFAULT_DESCRIPTION = "A Starfinder 2E community and game management tool for organizing games, sessions, and characters.";
export const SOCIAL_IMAGE_PATH = "/nexus-codex-social-preview-v2.png";

export function getSiteUrl(): URL {
  const configuredUrl = process.env.NEXT_PUBLIC_SITE_URL ?? process.env.BETTER_AUTH_URL;
  const url = new URL(configuredUrl ?? "http://localhost:3000");
  return new URL(url.origin);
}

export function socialMetadata({
  title,
  description,
  pathname,
}: {
  title: string;
  description: string;
  pathname: string;
}): Metadata {
  return {
    title,
    description,
    alternates: { canonical: pathname },
    openGraph: {
      title,
      description,
      siteName: SITE_NAME,
      type: "website",
      url: pathname,
      images: [{
        url: SOCIAL_IMAGE_PATH,
        width: 1200,
        height: 630,
        alt: "Nexus Codex — A Starfinder 2E community and game management tool",
      }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [SOCIAL_IMAGE_PATH],
    },
  };
}

export const defaultSocialMetadata = socialMetadata({
  title: "Nexus Codex | Starfinder 2E Game Management",
  description: DEFAULT_DESCRIPTION,
  pathname: "/",
});
