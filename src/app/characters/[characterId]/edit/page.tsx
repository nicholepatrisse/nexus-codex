import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getAuthenticatedActor } from "@/auth/actor";
import { getCharacterDetail } from "@/character/characters";
import { EditCharacterForm } from "./edit-character-form";

export default async function EditCharacterPage({ params }: { params: Promise<{ characterId: string }> }) {
  const { characterId } = await params;
  const actor = await getAuthenticatedActor();
  if (!actor) redirect(`/sign-in?returnTo=${encodeURIComponent(`/characters/${characterId}/edit`)}`);
  const character = await getCharacterDetail(actor, characterId);
  if (!character || !character.isOwner) notFound();
  return <main className="mx-auto min-h-screen max-w-2xl px-6 py-16"><Link href={`/characters/${character.id}`} className="text-sm text-brand hover:underline">← Character details</Link><h1 className="mt-8 text-4xl font-semibold">Edit {character.name}</h1><p className="mt-3 text-text-muted">Update the details players and authorized GMs see.</p><EditCharacterForm character={character} /></main>;
}
