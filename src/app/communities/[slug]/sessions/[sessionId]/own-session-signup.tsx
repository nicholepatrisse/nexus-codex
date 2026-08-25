export interface OwnSessionSignupDetails {
  status: "confirmed" | "waitlisted";
  characterName: string;
  characterSocietyNumber?: string | null;
  waitlistPosition?: number | null;
}

export function OwnSessionSignup({ signup }: { signup: OwnSessionSignupDetails }) {
  const status = signup.status === "confirmed"
    ? "You’re registered"
    : `You’re waitlisted${signup.waitlistPosition ? ` at position ${signup.waitlistPosition}` : ""}`;

  return <section aria-labelledby="your-registration-heading" className="mt-8 rounded-2xl border border-emerald-200/20 bg-emerald-300/[0.08] p-5">
    <p className="text-sm font-semibold text-emerald-100">{status}</p>
    <h2 id="your-registration-heading" className="mt-3 text-sm text-[var(--muted)]">Your character</h2>
    <p className="mt-1 font-semibold text-white">
      {signup.characterName}
      {signup.characterSocietyNumber ? <span className="font-normal text-[var(--muted)]"> — {signup.characterSocietyNumber}</span> : null}
    </p>
  </section>;
}
