import Link from "next/link";
import { redirect } from "next/navigation";
import { getAuthenticatedActor } from "@/auth/actor";
import { CharacterClassIcon } from "@/character/character-class-icon";
import { listCharacters } from "@/character/characters";
export default async function CharactersPage() {
  const actor = await getAuthenticatedActor();
  if (!actor) redirect("/sign-in?returnTo=%2Fcharacters");
  const characterList = await listCharacters(actor);
  return <main className="mx-auto min-h-screen max-w-3xl px-6 py-16">
    <div className="flex items-end justify-between gap-6"><div><p className="text-sm font-semibold tracking-[0.2em] text-brand uppercase">Account</p><h1 className="mt-3 text-4xl font-semibold">Your characters</h1></div><Link href="/characters/new" className="rounded-full bg-brand px-5 py-3 font-semibold text-on-brand">Add character</Link></div>
    {characterList.length ? <ul className="mt-10 space-y-4">{characterList.map((character) => <li key={character.id} className="flex min-h-28 items-center justify-between gap-4 rounded-2xl border border-border bg-surface py-2 pr-3 pl-5 sm:min-h-32 sm:pr-4 sm:pl-6"><div className="min-w-0"><h2 className="truncate text-xl font-semibold"><Link className="hover:text-brand hover:underline" href={`/characters/${character.id}`}>{character.name}</Link></h2><p className="mt-1 truncate text-text-muted">{character.className ? `${character.className} · ` : ""}{character.societyNumber} · Level {character.currentLevel} · {character.totalXp} XP</p></div><CharacterClassIcon className={character.className} /></li>)}</ul> : <section className="mt-10 rounded-2xl border border-dashed border-border-strong p-8 text-center"><h2 className="text-xl font-semibold">No characters yet</h2><p className="mt-2 text-text-muted">Add your first character to use in games.</p></section>}
  </main>;
}
