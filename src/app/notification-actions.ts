"use server";

import { z } from "zod";
import { requireAuthenticatedActor } from "@/auth/actor";
import { clearNotifications, markNotificationsRead } from "@/notifications/repository";

const notificationIdsSchema = z.array(z.string().min(1).max(255)).max(500);

export async function markNotificationsReadAction(notificationIds: string[]) {
  const ids = notificationIdsSchema.parse(notificationIds);
  const actor = await requireAuthenticatedActor();
  await markNotificationsRead(actor.personId, ids);
}

export async function clearNotificationsAction(notificationIds: string[]) {
  const ids = notificationIdsSchema.parse(notificationIds);
  const actor = await requireAuthenticatedActor();
  await clearNotifications(actor.personId, ids);
}
