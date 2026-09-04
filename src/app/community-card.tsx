import Link from "next/link";
import type { ReactNode } from "react";

export function CommunityCard({ name, slug, description, metadata, href, muted = false, joined = false }: {
  name: string;
  slug: string;
  description?: string | null;
  metadata?: ReactNode;
  href: string;
  muted?: boolean;
  joined?: boolean;
}) {
  return (
    <Link href={href} className={`card-standard card-interactive relative block h-full overflow-hidden p-5 pl-20 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand sm:p-6 sm:pl-24 ${joined ? "card-selected border-l-4 border-l-success" : "border-l-4 border-l-brand"} ${muted ? "bg-surface/70 text-text-muted" : "bg-surface-raised"}`}>
      <span aria-hidden="true" className={`absolute top-5 left-4 grid size-11 place-items-center rounded-full sm:top-6 sm:left-6 ${joined ? "bg-success/12 text-success" : "bg-brand-muted text-brand"}`}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-6"><path strokeLinecap="round" strokeLinejoin="round" d="M8.5 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7-1a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM3.5 19v-1.5a5 5 0 0 1 10 0V19m1-6a4.5 4.5 0 0 1 5.5 4.4V19" /></svg></span>
      <span aria-hidden="true" className="absolute top-1/2 right-5 -translate-y-1/2 text-2xl text-brand">›</span>
      <span className="flex items-start justify-between gap-3 pr-8"><h3 className="text-lg font-semibold text-text-primary sm:text-xl">{name}</h3>{joined ? <span className="rounded-full border border-success/35 bg-success/10 px-2.5 py-1 text-xs font-semibold text-success">Joined</span> : null}</span>
      {metadata ? <span className="mt-2 inline-flex rounded-full border border-border bg-surface/55 px-2.5 py-1 text-xs font-semibold text-text-muted">{metadata}</span> : <span className="mt-1 block text-sm font-medium text-brand">/{slug}</span>}
      {description ? <span className="mt-4 line-clamp-3 block pr-8 leading-6 text-text-muted">{description}</span> : null}
    </Link>
  );
}
