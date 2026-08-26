import { redirect } from "next/navigation";
import { getAuthenticatedActor } from "@/auth/actor";
import { getProfile } from "@/profile/profile";
import { parseSessionReturnTo } from "@/character/character-creation-return";
import { SocietyNumberGate } from "./society-number-gate";

export default async function NewCharacterPage({ searchParams }: { searchParams: Promise<{ returnTo?: string }> }) {
  const requestedReturnTo = (await searchParams).returnTo;
  const returnTo = parseSessionReturnTo(requestedReturnTo) ? requestedReturnTo : undefined;
  const actor = await getAuthenticatedActor();
  if (!actor) {
    const characterPath = returnTo ? `/characters/new?returnTo=${encodeURIComponent(returnTo)}` : "/characters/new";
    redirect(`/sign-in?returnTo=${encodeURIComponent(characterPath)}`);
  }
  const profile = await getProfile(actor);
  const societyPlayNumber = profile?.societyPlayNumber?.match(/^\d+$/)?.[0] ?? "";
  return <main className="mx-auto min-h-screen max-w-2xl px-6 py-16">
    <p className="text-sm font-semibold tracking-[0.2em] text-brand uppercase">Characters</p>
    <h1 className="mt-3 text-4xl font-semibold">Add a character</h1>
    <p className="mt-3 text-text-muted">Create a character attached to your account.</p>
    <SocietyNumberGate initialSocietyPlayNumber={societyPlayNumber} returnTo={returnTo} />
  </main>;
}
