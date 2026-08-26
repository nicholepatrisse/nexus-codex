export function NexusCodexMark({ className = "size-11" }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="24" cy="24" r="20.5" fill="var(--theme-surface)" stroke="var(--theme-border-strong)" />
      <path d="M15 33V15l18 18V15" stroke="var(--theme-text-primary)" strokeWidth="5" strokeLinejoin="miter" />
      <path d="M5.5 31.5c7.2 4.6 23.3 2.2 35.7-5.4" stroke="var(--theme-brand)" strokeWidth="2.6" strokeLinecap="round" />
      <path d="m24 4 1.25 4.75L30 10l-4.75 1.25L24 16l-1.25-4.75L18 10l4.75-1.25L24 4Z" fill="var(--theme-accent)" />
    </svg>
  );
}
