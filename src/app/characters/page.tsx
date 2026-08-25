import Link from "next/link";
import { redirect } from "next/navigation";
import { getAuthenticatedActor } from "@/auth/actor";
import { listCharacters } from "@/character/characters";
export default async function CharactersPage() {
  const actor = await getAuthenticatedActor();
  if (!actor) redirect("/sign-in?returnTo=%2Fcharacters");
  const characterList = await listCharacters(actor);
  return <main className="mx-auto min-h-screen max-w-3xl px-6 py-16">
    <div className="flex items-end justify-between gap-6"><div><p className="text-sm font-semibold tracking-[0.2em] text-[var(--accent)] uppercase">Account</p><h1 className="mt-3 text-4xl font-semibold">Your characters</h1></div><Link href="/characters/new" className="rounded-full bg-[var(--accent)] px-5 py-3 font-semibold text-[#07110f]">Add character</Link></div>
    {characterList.length ? <ul className="mt-10 space-y-4">{characterList.map((character) => <li key={character.id} className="rounded-2xl border border-white/10 bg-black/20 p-6"><h2 className="text-xl font-semibold"><Link className="hover:text-[var(--accent)] hover:underline" href={`/characters/${character.id}`}>{character.name}</Link></h2><p className="mt-2 text-[var(--muted)]">{character.societyNumber}</p></li>)}</ul> : <section className="mt-10 rounded-2xl border border-dashed border-white/15 p-8 text-center"><h2 className="text-xl font-semibold">No characters yet</h2><p className="mt-2 text-[var(--muted)]">Add your first character to use in games.</p></section>}
  </main>;
}
