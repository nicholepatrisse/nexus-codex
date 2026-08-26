import { afterEach, describe, expect, it } from "vitest";
import { DEFAULT_DESCRIPTION, SOCIAL_IMAGE_PATH, getSiteUrl, socialMetadata } from "@/app/social-metadata";

const originalSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;

afterEach(() => {
  if (originalSiteUrl === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
  else process.env.NEXT_PUBLIC_SITE_URL = originalSiteUrl;
});

describe("social metadata", () => {
  it("uses the configured public production origin", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://nexus.example/path";
    expect(getSiteUrl().href).toBe("https://nexus.example/");
  });

  it("provides matching Open Graph and Twitter cards with canonical paths", () => {
    const metadata = socialMetadata({ title: "Test | Nexus Codex", description: DEFAULT_DESCRIPTION, pathname: "/test" });
    expect(metadata.alternates).toEqual({ canonical: "/test" });
    expect(metadata.openGraph).toMatchObject({ title: "Test | Nexus Codex", url: "/test", siteName: "Nexus Codex" });
    expect(metadata.twitter).toMatchObject({ card: "summary_large_image", title: "Test | Nexus Codex", images: [SOCIAL_IMAGE_PATH] });
  });
});
