import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getAuthenticatedActor } from "@/auth/actor";
import { getCharacterDetail } from "@/character/characters";
import { getEditableManualChronicle, listChronicleContentItems } from "@/character/chronicles";
import { updateChronicleAction } from "../../actions";
import { ChronicleForm } from "../../chronicle-form";

export default async function EditChroniclePage({ params }: { params: Promise<{ characterId: string; chronicleId: string }> }) {
  const { characterId, chronicleId } = await params; const actor = await getAuthenticatedActor();
  if (!actor) redirect(`/sign-in?returnTo=${encodeURIComponent(`/characters/${characterId}/chronicles/${chronicleId}/edit`)}`);
  const [character, chronicle, catalogItems] = await Promise.all([getCharacterDetail(actor, characterId), getEditableManualChronicle(actor, characterId, chronicleId), listChronicleContentItems()]);
  if (!character?.isOwner || !chronicle) notFound();
  return <main className="mx-auto min-h-screen max-w-2xl px-6 py-16"><Link href={`/characters/${characterId}`} className="text-sm text-brand hover:underline">← Character details</Link><h1 className="mt-8 text-4xl font-semibold">Edit Chronicle</h1><p className="mt-3 text-text-muted">Updates preserve this Chronicle’s identity and stored rewards.</p><ChronicleForm characterId={characterId} chronicle={{ ...chronicle, provenance: "manual" }} catalogItems={catalogItems} action={updateChronicleAction.bind(null, characterId, chronicleId)} /></main>;
}
