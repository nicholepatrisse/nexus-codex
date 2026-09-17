"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { authClient } from "@/auth/client";
import { signOutAndRedirect } from "@/auth/sign-out";
import { clearNotificationsAction, markNotificationsReadAction } from "@/app/notification-actions";
import { notificationBadgeCount, type AppNotification } from "@/notifications/model";

export function profileInitials(displayName: string) {
  const parts = displayName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0 || displayName === "Profile") return "AC";
  if (parts.length === 1) return [...(parts[0] ?? "")].slice(0, 2).join("").toLocaleUpperCase();
  return `${[...(parts[0] ?? "")][0] ?? ""}${[...(parts.at(-1) ?? "")][0] ?? ""}`.toLocaleUpperCase();
}

function HomeIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-6"><path strokeLinecap="round" strokeLinejoin="round" d="m3.5 10.5 8.5-7 8.5 7V20a1 1 0 0 1-1 1h-5v-6h-4v6h-5a1 1 0 0 1-1-1v-9.5Z" /></svg>;
}

function DiscoverIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-6"><circle cx="11" cy="11" r="6.5" /><path strokeLinecap="round" d="m16 16 4.5 4.5" /></svg>;
}

function PeopleIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-6"><path strokeLinecap="round" strokeLinejoin="round" d="M8.5 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7-1a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM3 19v-1.5A4.5 4.5 0 0 1 7.5 13h2a4.5 4.5 0 0 1 4.5 4.5V19m0-5.5a4 4 0 0 1 7 2.7V19" /></svg>;
}

function CharacterIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-6"><circle cx="12" cy="7.5" r="3.5" /><path strokeLinecap="round" strokeLinejoin="round" d="M5.5 21v-2.5a6.5 6.5 0 0 1 13 0V21M9 13.5l3 3 3-3" /></svg>;
}

function ChevronIcon() {
  return <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-4 shrink-0"><path strokeLinecap="round" strokeLinejoin="round" d="m6.5 8 3.5 3.5L13.5 8" /></svg>;
}

const mobileNavigation = [
  { href: "/", label: "Home", icon: HomeIcon, active: (pathname: string) => pathname === "/" },
  { href: "/games/browse", label: "Discover", icon: DiscoverIcon, active: (pathname: string) => pathname.startsWith("/games") },
  { href: "/communities", label: "Communities", icon: PeopleIcon, active: (pathname: string) => pathname.startsWith("/communities") },
  { href: "/characters", label: "Characters", icon: CharacterIcon, active: (pathname: string) => pathname.startsWith("/characters") },
] as const;

export function ApplicationHeader({ notifications, notificationsError = false, displayName, avatarUrl = null, initiallySignedIn }: { notifications: AppNotification[]; notificationsError?: boolean; displayName: string; avatarUrl?: string | null; initiallySignedIn: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const { data: session, isPending } = authClient.useSession();
  const [open, setOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement>(null);
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
  const initials = profileInitials(displayName);

  useEffect(() => {
    function closeAccountMenu(event: MouseEvent) {
      if (!accountMenuRef.current?.contains(event.target as Node)) setAccountOpen(false);
    }
    function closeAccountMenuOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setAccountOpen(false);
    }
    document.addEventListener("mousedown", closeAccountMenu);
    document.addEventListener("keydown", closeAccountMenuOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeAccountMenu);
      document.removeEventListener("keydown", closeAccountMenuOnEscape);
    };
  }, []);

  if (pathname === "/" && !signedIn) return null;

  function toggleNotifications() {
    const nextOpen = !open;
    setOpen(nextOpen);
    setAccountOpen(false);
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
    setSignOutPending(true);
    setSignOutError(false);
    const result = await signOutAndRedirect(() => authClient.signOut(), (href) => router.replace(href));
    if (result.error) {
      setSignOutError(true);
      setSignOutPending(false);
    }
  }

  const accountLinkClass = (active: boolean) =>
    `application-nav-link ${active ? "application-nav-link-active" : ""}`;
  const utilityControlClass = "rounded-full border border-border-strong bg-surface px-4 py-2 text-sm font-semibold whitespace-nowrap text-text-primary transition-colors hover:border-brand hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-offset-2";

  return <>
    <header className="sticky top-0 z-50 bg-transparent">
      <div className="mx-auto flex min-h-20 max-w-7xl items-center gap-2 px-3 sm:px-6 md:gap-4">
        <Link href="/" aria-label="Nexus Codex home" className="relative h-20 w-[7.5rem] shrink-0 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2">
          <Image src="/nexus-codex-wordmark.png" alt="" fill priority sizes="120px" className="application-wordmark object-contain" />
        </Link>

        <nav aria-label="Primary" className="hidden min-w-0 flex-1 items-center gap-1 md:flex lg:gap-2">
          {session ? <Link href="/characters" aria-current={pathname.startsWith("/characters") ? "page" : undefined} className={accountLinkClass(pathname.startsWith("/characters"))}><span className="application-nav-icon"><CharacterIcon /></span><span>Characters</span></Link> : null}
          {session ? <Link href="/communities" aria-current={pathname.startsWith("/communities") ? "page" : undefined} className={accountLinkClass(pathname.startsWith("/communities"))}><span className="application-nav-icon"><PeopleIcon /></span><span>Communities</span></Link> : null}
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-3">
          {isPending ? <span className="hidden text-sm text-text-muted md:inline" role="status">Checking your session…</span> : null}
          {!isPending && !session ? <Link href="/sign-in" className={utilityControlClass}>Sign in</Link> : null}
          {session ? <>
            <div className="relative">
              <button type="button" aria-label={`Notifications${badgeCount ? `, ${badgeCount} unread or actionable` : ""}`} aria-expanded={open} aria-controls="notification-panel" onClick={toggleNotifications} className="application-notification-button">
                <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-6"><path strokeLinecap="round" strokeLinejoin="round" d="M14.9 18a3 3 0 0 1-5.8 0m9.4-2.5H5.5c1.3-1.4 2-3.2 2-5.1V9a4.5 4.5 0 0 1 9 0v1.4c0 1.9.7 3.7 2 5.1Z" /></svg>
                {badgeCount ? <span aria-hidden="true" className="application-notification-indicator" /> : null}
              </button>
              {open ? <section id="notification-panel" aria-label="Notifications" className="application-notification-panel"><div className="application-notification-panel-header"><div><span>Incoming signal</span><h2>Notifications</h2></div>{displayedNotifications.length ? <button type="button" onClick={clearAllNotifications} className="application-notification-clear">Clear all</button> : null}</div>{notificationsError ? <p role="alert" className="application-notification-state text-danger">Notifications could not be loaded.</p> : null}{!notificationsError && displayedNotifications.length === 0 ? <p className="application-notification-state text-text-muted">You’re all caught up.</p> : null}{displayedNotifications.length ? <ul className="application-notification-list">{displayedNotifications.map((item) => { const notificationClass = `application-notification-item ${item.isRead ? "" : "application-notification-item-unread"}`; const content = <><span className="block font-semibold">{item.title}</span><span className="mt-1 block text-sm text-text-muted">{item.message}</span>{!item.isRead ? <span aria-label="Unread" className="application-notification-item-dot" /> : null}</>; return <li key={item.id}>{item.href ? <Link href={item.href} onClick={() => setOpen(false)} className={notificationClass}>{content}</Link> : <div className={notificationClass}>{content}</div>}</li>; })}</ul> : null}</section> : null}
            </div>
            <span aria-hidden="true" className="application-header-divider" />
            <div ref={accountMenuRef} className="relative min-w-0">
              <button type="button" aria-label={`${displayName} account menu`} aria-expanded={accountOpen} aria-controls="account-menu" aria-haspopup="menu" title={displayName} onClick={() => { setAccountOpen((current) => !current); setOpen(false); }} className={`application-profile-link ${pathname === "/profile" ? "application-profile-link-active" : ""}`}>
                <span className="application-profile-avatar">{avatarUrl ? <Image src={avatarUrl} alt="" width={56} height={56} unoptimized /> : initials}</span>
                <span className="application-profile-greeting"><span>Hello,</span><strong>{displayName}</strong></span>
                <span className={`transition-transform ${accountOpen ? "rotate-180" : ""}`}><ChevronIcon /></span>
              </button>
              <nav id="account-menu" aria-label="Account" hidden={!accountOpen} className="application-account-menu">
                <Link href="/profile" onClick={() => setAccountOpen(false)}><span>Profile</span><small>Personal details</small></Link>
                <Link href="/profile?tab=notifications" onClick={() => setAccountOpen(false)}><span>Notifications</span><small>Preferences</small></Link>
                <Link href="/profile?tab=materials" onClick={() => setAccountOpen(false)}><span>Materials</span><small>Owned sources</small></Link>
                <button type="button" disabled={signOutPending} onClick={() => { setAccountOpen(false); void signOut(); }} className="application-account-signout"><span>{signOutPending ? "Signing out…" : "Sign out"}</span><small>End this session</small></button>
              </nav>
            </div>
            <button type="button" disabled={signOutPending} onClick={signOut} aria-label={signOutPending ? "Signing out" : "Sign out"} title={signOutPending ? "Signing out…" : "Sign out"} className="application-signout-button">
              <svg aria-hidden="true" className="application-signout-frame" viewBox="0 0 120 48" preserveAspectRatio="none"><path d="M10 1 H119 V38 L110 47 H1 V10 Z" /></svg>
              <span>{signOutPending ? "Signing out…" : "Sign out"}</span>
            </button>
          </> : null}
        </div>
      </div>
      {signOutError ? <p role="alert" className="mx-auto max-w-7xl px-6 pb-2 text-right text-sm text-danger">Sign-out failed. Please try again.</p> : null}
    </header>

    {session ? <nav aria-label="Mobile primary" className="fixed inset-x-0 bottom-0 z-50 border-t border-border-strong bg-surface/95 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-8px_24px_color-mix(in_srgb,var(--theme-background)_35%,transparent)] backdrop-blur md:hidden">
      <div className="mx-auto grid max-w-md grid-cols-4">
        {mobileNavigation.map(({ href, label, icon: Icon, active }) => { const current = active(pathname); return <Link key={href} href={href} aria-current={current ? "page" : undefined} className={`application-mobile-nav-link ${current ? "application-mobile-nav-link-active" : ""}`}><span className="application-mobile-nav-icon"><Icon /></span><span>{label}</span></Link>; })}
      </div>
    </nav> : null}
  </>;
}
