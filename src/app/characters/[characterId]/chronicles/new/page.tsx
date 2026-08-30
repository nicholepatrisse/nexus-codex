import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getAuthenticatedActor } from "@/auth/actor";
import { getCharacterDetail } from "@/character/characters";
import { listChronicleContentItems } from "@/character/chronicles";
import { addChronicleScenarioAction, createChronicleAction, previewChronicleScenarioAction } from "../actions";
import { ChronicleForm } from "../chronicle-form";

export default async function NewChroniclePage({ params }: { params: Promise<{ characterId: string }> }) {
  const { characterId } = await params; const actor = await getAuthenticatedActor();
  if (!actor) redirect(`/sign-in?returnTo=${encodeURIComponent(`/characters/${characterId}/chronicles/new`)}`);
  const character = await getCharacterDetail(actor, characterId); if (!character?.isOwner) notFound();
  return <main className="mx-auto min-h-screen max-w-2xl px-6 py-16"><Link href={`/characters/${characterId}?tab=chronicles`} className="text-sm text-brand hover:underline">← {character.name} Chronicles</Link><h1 className="mt-8 text-4xl font-semibold">Add Chronicle</h1><p className="mt-3 text-text-muted">Record Society play for {character.name} without creating a Nexus session.</p><ChronicleForm characterId={characterId} catalogItems={await listChronicleContentItems()} action={createChronicleAction.bind(null, characterId)} previewScenario={previewChronicleScenarioAction} addScenario={addChronicleScenarioAction} /></main>;
}
