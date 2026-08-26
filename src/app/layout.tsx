import type { Metadata } from "next";
import "./globals.css";
import { getAuthenticatedActor } from "@/auth/actor";
import { ApplicationHeader } from "@/app/application-header";
import { ApplicationFooter } from "@/app/application-footer";
import { listNotificationsForPerson } from "@/notifications/repository";
import type { AppNotification } from "@/notifications/model";
import { getProfile } from "@/profile/profile";

export const metadata: Metadata = {
  title: "Nexus Codex",
  description: "A central tracker for organized Society play.",
  applicationName: "Nexus Codex",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/apple-icon.png", sizes: "180x180", type: "image/png" }],
  },
  openGraph: {
    title: "Nexus Codex",
    description: "A central tracker for organized Society play.",
    siteName: "Nexus Codex",
    type: "website",
    images: [{ url: "/opengraph-image.png", width: 1200, height: 630, alt: "Nexus Codex" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Nexus Codex",
    description: "A central tracker for organized Society play.",
    images: ["/opengraph-image.png"],
  },
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const actor = await getAuthenticatedActor();
  let notifications: AppNotification[] = [];
  let displayName = "Profile";
  let notificationsError = false;
  if (actor) { try { notifications = await listNotificationsForPerson(actor.personId); } catch { notificationsError = true; } displayName = (await getProfile(actor))?.displayName ?? displayName; }
  return <html lang="en"><body className="flex min-h-screen flex-col"><ApplicationHeader notifications={notifications} notificationsError={notificationsError} displayName={displayName} initiallySignedIn={Boolean(actor)} /><div className="flex-1">{children}</div><ApplicationFooter /></body></html>;
}
