import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getAuthenticatedActor } from "@/auth/actor";
import { listChronicles } from "@/character/chronicles";
import { getOwnedInventoryEntry } from "@/character/inventory";
import { updateInventoryAction } from "../../actions";
import { InventoryForm } from "../../inventory-form";
export default async function EditInventoryPage({ params }: { params: Promise<{ characterId: string; entryId: string }> }) { const { characterId, entryId } = await params; const actor = await getAuthenticatedActor(); if (!actor) redirect(`/sign-in?returnTo=/characters/${characterId}/inventory/${entryId}/edit`); const entry = await getOwnedInventoryEntry(actor, characterId, entryId); if (!entry) notFound(); const chronicles = await listChronicles(characterId); return <main className="mx-auto min-h-screen max-w-2xl px-6 py-16"><Link className="text-sm text-brand hover:underline" href={`/characters/${characterId}`}>← Character</Link><h1 className="mt-8 text-4xl font-semibold">Edit inventory</h1><InventoryForm characterId={characterId} entry={entry} chronicles={chronicles} action={updateInventoryAction.bind(null, characterId, entryId)} /></main>; }
