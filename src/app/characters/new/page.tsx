import { redirect } from "next/navigation";
import { getAuthenticatedActor } from "@/auth/actor";
import { listCharacters } from "@/character/characters";
import { getProfile } from "@/profile/profile";
import { parseSessionReturnTo } from "@/character/character-creation-return";
import { SocietyNumberGate } from "./society-number-gate";
import { getIdentityValidationContext } from "@/character/identity-validation-context";

export default async function NewCharacterPage({ searchParams }: { searchParams: Promise<{ returnTo?: string }> }) {
  const requestedReturnTo = (await searchParams).returnTo;
  const returnTo = parseSessionReturnTo(requestedReturnTo) ? requestedReturnTo : undefined;
  const actor = await getAuthenticatedActor();
  if (!actor) {
    const characterPath = returnTo ? `/characters/new?returnTo=${encodeURIComponent(returnTo)}` : "/characters/new";
    redirect(`/sign-in?returnTo=${encodeURIComponent(characterPath)}`);
  }
  const [profile, characters, validationContext] = await Promise.all([getProfile(actor), listCharacters(actor), getIdentityValidationContext(actor)]);
  const societyPlayNumber = profile?.societyPlayNumber?.match(/^\d+$/)?.[0] ?? "";
  const societyPrefix = `${societyPlayNumber}-27`;
  const usedCharacterNumbers = characters.flatMap(({ societyNumber }) => societyNumber.startsWith(societyPrefix) ? [societyNumber.slice(societyPrefix.length)] : []);
  return <main className="page-shell mx-auto min-h-screen max-w-2xl">
    <p className="text-sm font-semibold tracking-[0.2em] text-brand uppercase">Characters</p>
    <h1 className="responsive-title mt-3 font-semibold">Add a character</h1>
    <p className="mt-3 text-text-muted">Create a character attached to your account.</p>
    <SocietyNumberGate initialSocietyPlayNumber={societyPlayNumber} usedCharacterNumbers={usedCharacterNumbers} validationContext={validationContext} returnTo={returnTo} />
  </main>;
}
