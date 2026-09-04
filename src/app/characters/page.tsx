import Link from "next/link";
import { redirect } from "next/navigation";
import { getAuthenticatedActor } from "@/auth/actor";
import { EmptyState } from "@/app/empty-state";
import { listCharacters } from "@/character/characters";
import { getCharacterValidationReview } from "@/character/character-validation-review";
import { CharacterSummaryCard } from "@/app/character-summary-card";
export default async function CharactersPage() {
  const actor = await getAuthenticatedActor();
  if (!actor) redirect("/sign-in?returnTo=%2Fcharacters");
  const characterList = await listCharacters(actor);
  const validationByCharacter = new Map(await Promise.all(characterList.map(async (character) => {
    const review = await getCharacterValidationReview(actor, character.id);
    return [character.id, review?.summary.presentation ?? "Needs Review"] as const;
  })));
  return <main className="page-shell mx-auto min-h-screen max-w-3xl">
    <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-end sm:justify-between sm:gap-6"><div><p className="text-xs font-semibold tracking-[0.18em] text-brand uppercase sm:text-sm sm:tracking-[0.2em]">Account</p><h1 className="responsive-title mt-2 font-semibold sm:mt-3">Your characters</h1></div><Link href="/characters/new" className="rounded-full bg-brand px-4 py-2.5 text-sm font-semibold whitespace-nowrap text-on-brand sm:px-5 sm:py-3 sm:text-base">Add character</Link></div>
    {characterList.length ? <ul className="mt-7 space-y-3 sm:mt-10 sm:space-y-4">{characterList.map((character) => <li key={character.id}><CharacterSummaryCard character={{ ...character, level: character.currentLevel }} validation={validationByCharacter.get(character.id) ?? "Needs Review"} /></li>)}</ul> : <EmptyState as="section" align="center" className="responsive-card mt-7 sm:mt-10" title="No characters yet" description="Add your first character to use in games." />}
  </main>;
}
