import type { Metadata } from "next";
import "./globals.css";
import { getAuthenticatedActor } from "@/auth/actor";
import { ApplicationHeader } from "@/app/application-header";
import { listNotificationsForPerson } from "@/notifications/repository";
import type { AppNotification } from "@/notifications/model";

export const metadata: Metadata = {
  title: "Nexus Codex",
  description: "A central tracker for organized Society play.",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const actor = await getAuthenticatedActor();
  let notifications: AppNotification[] = [];
  let notificationsError = false;
  if (actor) { try { notifications = await listNotificationsForPerson(actor.personId); } catch { notificationsError = true; } }
  return <html lang="en"><body>{actor ? <ApplicationHeader notifications={notifications} notificationsError={notificationsError} /> : null}{children}</body></html>;
}
