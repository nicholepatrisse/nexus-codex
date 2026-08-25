"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { authClient } from "@/auth/client";
import { signOutAndRedirect } from "@/auth/sign-out";
import { clearNotificationsAction, markNotificationsReadAction } from "@/app/notification-actions";
import { notificationBadgeCount, type AppNotification } from "@/notifications/model";

export function ApplicationHeader({ notifications, notificationsError = false, displayName, initiallySignedIn }: { notifications: AppNotification[]; notificationsError?: boolean; displayName: string; initiallySignedIn: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const { data: session, isPending } = authClient.useSession();
  const [open, setOpen] = useState(false);
  const [readIds, setReadIds] = useState<Set<string>>(
    () => new Set(notifications.filter(({ isRead }) => isRead).map(({ id }) => id)),
  );
  const [clearedIds, setClearedIds] = useState<Set<string>>(new Set());
  const [signOutPending, setSignOutPending] = useState(false);
  const [signOutError, setSignOutError] = useState(false);
  const displayedNotifications = useMemo(() => notifications.filter(({ id }) => !clearedIds.has(id)).map((item) => ({
    ...item,
    isRead: item.isRead || readIds.has(item.id),
  })), [notifications, readIds, clearedIds]);
  const badgeCount = useMemo(() => notificationBadgeCount(displayedNotifications), [displayedNotifications]);
  const signedIn = isPending ? initiallySignedIn : Boolean(session);
  if (pathname === "/" && !signedIn) return null;
  function toggleNotifications() {
    const nextOpen = !open; setOpen(nextOpen);
    if (!nextOpen) return;
    const unreadIds = displayedNotifications.filter(({ isRead }) => !isRead).map(({ id }) => id);
    if (unreadIds.length === 0) return;
    setReadIds((current) => new Set([...current, ...unreadIds]));
    void markNotificationsReadAction(unreadIds).catch(() => router.refresh());
  }
  function clearAllNotifications() {
    const ids = displayedNotifications.map(({ id }) => id);
    if (ids.length === 0) return;
    setClearedIds((current) => new Set([...current, ...ids]));
    void clearNotificationsAction(ids).catch(() => router.refresh());
  }
  async function signOut() {
    setSignOutPending(true); setSignOutError(false);
    const result = await signOutAndRedirect(() => authClient.signOut(), (href) => router.replace(href));
    if (result.error) { setSignOutError(true); setSignOutPending(false); }
  }
  const accountLinkClass = (active: boolean) =>
    `rounded-lg px-5 py-3 text-sm font-semibold transition ${active ? "bg-[#111827] text-white shadow-sm" : "text-slate-300 hover:bg-white/5 hover:text-white"}`;
  return <header className="sticky top-0 z-50 border-b border-white/10 bg-[#1e293b]/95 shadow-lg backdrop-blur"><div className="mx-auto flex min-h-20 max-w-6xl items-center gap-5 px-6">
    <Link href="/" aria-label="Nexus Codex home" className="mr-2 flex items-center"><span aria-hidden="true" className="grid size-9 place-items-center rounded-xl bg-[var(--accent)] text-lg font-black text-[#0b1320]">N</span></Link><nav aria-label="Primary" className="flex min-w-0 flex-1 items-center gap-2">
      {isPending ? <span className="text-sm text-[var(--muted)]" role="status">Checking your session…</span> : null}
      {!isPending && !session ? <Link href="/sign-in" className="rounded-full border border-white/15 px-4 py-2 text-sm font-semibold hover:border-[var(--accent)]">Sign in</Link> : null}
      {session ? <Link href="/characters" aria-current={pathname.startsWith("/characters") ? "page" : undefined} className={accountLinkClass(pathname.startsWith("/characters"))}>Characters</Link> : null}
      {session ? <><Link href="/profile" aria-current={pathname === "/profile" ? "page" : undefined} title={displayName} className={accountLinkClass(pathname === "/profile")}><span>Profile</span></Link><div className="relative ml-auto"><button type="button" aria-label={`Notifications${badgeCount ? `, ${badgeCount} unread or actionable` : ""}`} aria-expanded={open} aria-controls="notification-panel" onClick={toggleNotifications} className="relative grid size-10 place-items-center rounded-full border border-white/15 hover:border-[var(--accent)]"><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-5"><path strokeLinecap="round" strokeLinejoin="round" d="M14.9 18a3 3 0 0 1-5.8 0m9.4-2.5H5.5c1.3-1.4 2-3.2 2-5.1V9a4.5 4.5 0 0 1 9 0v1.4c0 1.9.7 3.7 2 5.1Z" /></svg>{badgeCount ? <span className="absolute -right-1.5 -top-1.5 min-w-5 rounded-full bg-[var(--accent)] px-1 text-center text-xs font-bold leading-5 text-[#07110f]">{badgeCount}</span> : null}</button>
      {open ? <section id="notification-panel" aria-label="Notifications" className="absolute right-0 z-20 mt-2 w-[min(22rem,calc(100vw-2rem))] rounded-2xl border border-white/15 bg-[#111722] p-3 shadow-2xl"><div className="flex items-center justify-between px-2 py-1"><h2 className="font-semibold">Notifications</h2>{displayedNotifications.length ? <button type="button" onClick={clearAllNotifications} className="text-sm text-[var(--accent)] hover:underline">Clear all</button> : null}</div>{notificationsError ? <p role="alert" className="p-2 text-sm text-red-300">Notifications could not be loaded.</p> : null}{!notificationsError && displayedNotifications.length === 0 ? <p className="p-2 text-sm text-[var(--muted)]">You’re all caught up.</p> : null}{displayedNotifications.length ? <ul className="mt-1 space-y-1">{displayedNotifications.map((item) => <li key={item.id}>{item.href ? <Link href={item.href} onClick={() => setOpen(false)} className="block rounded-xl p-2 hover:bg-white/5"><span className="block font-semibold">{item.title}</span><span className="mt-1 block text-sm text-[var(--muted)]">{item.message}</span></Link> : <div className="rounded-xl p-2"><span className="block font-semibold">{item.title}</span><span className="mt-1 block text-sm text-[var(--muted)]">{item.message}</span></div>}</li>)}</ul> : null}</section> : null}</div>
      <button type="button" disabled={signOutPending} onClick={signOut} className="rounded-full border border-white/15 px-4 py-2 text-sm font-semibold disabled:opacity-60">{signOutPending ? "Signing out…" : "Sign out"}</button></> : null}
    </nav></div>{signOutError ? <p role="alert" className="mx-auto max-w-5xl px-6 pb-2 text-right text-sm text-red-300">Sign-out failed. Please try again.</p> : null}</header>;
}
