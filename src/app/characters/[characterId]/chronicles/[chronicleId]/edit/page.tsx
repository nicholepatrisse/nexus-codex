import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getAuthenticatedActor } from "@/auth/actor";
import { getCharacterDetail } from "@/character/characters";
import { getEditableManualChronicle, listChronicleContentItems } from "@/character/chronicles";
import { deleteChronicleAction, updateChronicleAction } from "../../actions";
import { ChronicleForm } from "../../chronicle-form";
import { DeleteChronicleButton } from "../../delete-chronicle-button";

export default async function EditChroniclePage({ params }: { params: Promise<{ characterId: string; chronicleId: string }> }) {
  const { characterId, chronicleId } = await params; const actor = await getAuthenticatedActor();
  if (!actor) redirect(`/sign-in?returnTo=${encodeURIComponent(`/characters/${characterId}/chronicles/${chronicleId}/edit`)}`);
  const [character, chronicle, catalogItems] = await Promise.all([getCharacterDetail(actor, characterId), getEditableManualChronicle(actor, characterId, chronicleId), listChronicleContentItems()]);
  if (!character?.isOwner || !chronicle) notFound();
  return <main className="mx-auto min-h-screen max-w-2xl px-6 py-16"><Link href={`/characters/${characterId}?tab=chronicles`} className="text-sm text-brand hover:underline">← Character Chronicles</Link><h1 className="mt-8 text-4xl font-semibold">Edit Chronicle</h1><p className="mt-3 text-text-muted">Updates preserve this Chronicle’s identity and adjust applied rewards when necessary.</p><ChronicleForm characterId={characterId} chronicle={chronicle} catalogItems={catalogItems} action={updateChronicleAction.bind(null, characterId, chronicleId)} /><section className="mt-10 border-t border-border pt-6"><h2 className="font-semibold text-danger">Delete Chronicle</h2><p className="mt-1 text-sm text-text-muted">Permanently remove this manual Chronicle{chronicle.status === "applied" ? " and its applied XP and credits" : ""}. Remaining Chronicles will be renumbered and rechecked. This cannot be undone.</p><div className="mt-3"><DeleteChronicleButton scenario={`${chronicle.scenarioNumberSnapshot} — ${chronicle.scenarioNameSnapshot}`} action={deleteChronicleAction.bind(null, characterId, chronicleId)} /></div></section></main>;
}
