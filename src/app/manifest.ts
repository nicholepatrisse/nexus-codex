import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Nexus Codex",
    short_name: "Nexus Codex",
    description: "A central tracker for organized Society play.",
    start_url: "/",
    display: "standalone",
    background_color: "#0e1724",
    theme_color: "#131b28",
    icons: [
      { src: "/icons/nexus-codex-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/nexus-codex-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/nexus-codex-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
