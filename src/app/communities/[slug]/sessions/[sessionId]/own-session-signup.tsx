import type { ReactNode } from "react";
import { SessionSignupControl } from "../../session-signup-control";

export interface OwnSessionSignupDetails {
  status: "confirmed" | "waitlisted";
  characterName: string;
  characterSocietyNumber?: string | null;
  characterLevel?: number | null;
  waitlistPosition?: number | null;
  characterId?: string;
  slug?: string;
  sessionId?: string;
  canManage?: boolean;
  characters?: { id: string; name: string; societyNumber: string; currentLevel: number }[];
  pregenName?: string;
  pregenLevel?: number;
  creditRecipientCharacterId?: string;
  creditRecipientCharacterName?: string;
  scenarioPregenLevel?: number;
}

export function OwnSessionSignup({ signup, children }: { signup: OwnSessionSignupDetails; children?: ReactNode }) {
  const status = signup.status === "confirmed"
    ? "You’re registered"
    : `You’re waitlisted${signup.waitlistPosition ? ` at position ${signup.waitlistPosition}` : ""}`;

  return <section aria-labelledby="your-registration-heading" className="mt-8 rounded-2xl border border-success/30 bg-success/10 p-5">
    <p className="text-sm font-semibold text-success">{status}</p>
    <h2 id="your-registration-heading" className="mt-3 text-sm text-text-muted">{signup.pregenName ? "Playing as" : "Your character"}</h2>
    <p className="mt-1 font-semibold text-text-primary">
      {signup.characterName}
      {signup.characterSocietyNumber ? <span className="font-normal text-text-muted"> — {signup.characterSocietyNumber}</span> : null}
      {signup.characterLevel ? <span className="font-normal text-text-muted"> — Level {signup.characterLevel}</span> : null}
    </p>
    {signup.pregenName && signup.creditRecipientCharacterName ? <p className="mt-2 text-sm"><span className="font-semibold">Credit goes to:</span> {signup.creditRecipientCharacterName}</p> : null}
    {signup.slug && signup.sessionId && (signup.characterId || signup.pregenName) ? signup.canManage
      ? <SessionSignupControl slug={signup.slug} sessionId={signup.sessionId} initialStatus={signup.status} initialCharacterId={signup.characterId} initialCharacterName={signup.characterName} initialPregenName={signup.pregenName} initialPregenLevel={signup.pregenLevel} initialCreditRecipientCharacterId={signup.creditRecipientCharacterId} scenarioPregenLevel={signup.scenarioPregenLevel} characters={signup.characters ?? []} />
      : <p className="mt-3 text-sm text-text-muted">This signup can no longer be changed because the session has started or is unavailable.</p>
      : null}
    {children}
  </section>;
}
