import Link from "next/link";
import type { ReactNode } from "react";

export function CommunityCard({ name, slug, description, metadata, href, muted = false }: {
  name: string;
  slug: string;
  description?: string | null;
  metadata?: ReactNode;
  href: string;
  muted?: boolean;
}) {
  return (
    <Link href={href} className={`card-standard card-interactive block h-full p-5 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand sm:p-6 ${muted ? "bg-surface/70 text-text-muted" : "bg-surface-raised"}`}>
      <h3 className="text-lg font-semibold text-text-primary sm:text-xl">{name}</h3>
      {metadata ? <span className="mt-2 block text-sm text-text-muted">{metadata}</span> : <span className="mt-1 block text-sm text-brand">/{slug}</span>}
      {description ? <span className="mt-4 line-clamp-3 block leading-6 text-text-muted">{description}</span> : null}
    </Link>
  );
}
