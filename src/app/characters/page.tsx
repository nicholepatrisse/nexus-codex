import { redirect } from "next/navigation";
import { getAuthenticatedActor } from "@/auth/actor";
import { EmptyState } from "@/app/empty-state";
import { listCharacters } from "@/character/characters";
import { getCharacterValidationReview } from "@/character/character-validation-review";
import { CharacterSummaryCard } from "@/app/character-summary-card";
import { ActionButton, PageHero } from "@/app/visual-system";
export default async function CharactersPage() {
  const actor = await getAuthenticatedActor();
  if (!actor) redirect("/sign-in?returnTo=%2Fcharacters");
  const characterList = await listCharacters(actor);
  const validationByCharacter = new Map(await Promise.all(characterList.map(async (character) => {
    const review = await getCharacterValidationReview(actor, character.id);
    return [character.id, review?.summary.presentation ?? "Needs Review"] as const;
  })));
  return <main className="page-shell character-page mx-auto min-h-screen max-w-6xl">
    <PageHero className="character-page-hero character-page-hero-art" eyebrow="Account" title="Your characters">
      <p>Your crew, your story. Manage your characters and their progress across the Starfinder Society.</p>
    </PageHero>
    <div className="character-page-action flex justify-end"><ActionButton href="/characters/new"><span aria-hidden="true" className="text-xl leading-none">＋</span>Add character</ActionButton></div>
    {characterList.length ? <ul className="character-list space-y-3 sm:space-y-4">{characterList.map((character) => <li key={character.id}><CharacterSummaryCard character={{ ...character, level: character.currentLevel }} validation={validationByCharacter.get(character.id) ?? "Needs Review"} /></li>)}</ul> : <EmptyState as="section" align="center" className="responsive-card mt-5 sm:mt-7" title="No characters yet" description="Add your first character to use in games." action={<ActionButton href="/characters/new" variant="secondary">Create a character</ActionButton>} />}
  </main>;
}
