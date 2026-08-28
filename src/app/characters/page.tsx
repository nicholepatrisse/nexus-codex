import Link from "next/link";
import { redirect } from "next/navigation";
import { getAuthenticatedActor } from "@/auth/actor";
import { CharacterClassIcon } from "@/character/character-class-icon";
import { listCharacters } from "@/character/characters";
export default async function CharactersPage() {
  const actor = await getAuthenticatedActor();
  if (!actor) redirect("/sign-in?returnTo=%2Fcharacters");
  const characterList = await listCharacters(actor);
  return <main className="page-shell mx-auto min-h-screen max-w-3xl">
    <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-end sm:justify-between sm:gap-6"><div><p className="text-xs font-semibold tracking-[0.18em] text-brand uppercase sm:text-sm sm:tracking-[0.2em]">Account</p><h1 className="responsive-title mt-2 font-semibold sm:mt-3">Your characters</h1></div><Link href="/characters/new" className="rounded-full bg-brand px-4 py-2.5 text-sm font-semibold whitespace-nowrap text-on-brand sm:px-5 sm:py-3 sm:text-base">Add character</Link></div>
    {characterList.length ? <ul className="mt-7 space-y-3 sm:mt-10 sm:space-y-4">{characterList.map((character) => <li key={character.id} className="flex min-h-24 items-center justify-between gap-3 rounded-2xl border border-border bg-surface py-3 pr-3 pl-4 sm:min-h-32 sm:gap-4 sm:pr-4 sm:pl-6"><div className="min-w-0"><h2 className="text-lg font-semibold sm:text-xl"><Link className="break-words hover:text-brand hover:underline" href={`/characters/${character.id}`}>{character.name}</Link></h2><p className="mt-1 text-sm leading-5 text-text-muted sm:text-base">{character.className ? `${character.className} · ` : ""}{character.societyNumber} · Level {character.currentLevel} · {character.totalXp} XP</p></div><CharacterClassIcon className={character.className} /></li>)}</ul> : <section className="responsive-card mt-7 rounded-2xl border border-dashed border-border-strong text-center sm:mt-10"><h2 className="text-xl font-semibold">No characters yet</h2><p className="mt-2 text-text-muted">Add your first character to use in games.</p></section>}
  </main>;
}
