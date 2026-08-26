import type { Metadata, Viewport } from "next";
import "./globals.css";
import { getAuthenticatedActor } from "@/auth/actor";
import { ApplicationHeader } from "@/app/application-header";
import { ApplicationFooter } from "@/app/application-footer";
import { listNotificationsForPerson } from "@/notifications/repository";
import type { AppNotification } from "@/notifications/model";
import { getProfile } from "@/profile/profile";
import { defaultSocialMetadata, getSiteUrl } from "@/app/social-metadata";

export const metadata: Metadata = {
  metadataBase: getSiteUrl(),
  ...defaultSocialMetadata,
  applicationName: "Nexus Codex",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/apple-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  colorScheme: "light dark",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#131b28" },
  ],
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const actor = await getAuthenticatedActor();
  let notifications: AppNotification[] = [];
  let displayName = "Profile";
  let notificationsError = false;
  if (actor) { try { notifications = await listNotificationsForPerson(actor.personId); } catch { notificationsError = true; } displayName = (await getProfile(actor))?.displayName ?? displayName; }
  return <html lang="en"><body className="flex min-h-screen flex-col"><ApplicationHeader notifications={notifications} notificationsError={notificationsError} displayName={displayName} initiallySignedIn={Boolean(actor)} /><div className="flex-1">{children}</div><ApplicationFooter /></body></html>;
}
