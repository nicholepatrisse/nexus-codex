import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getAuthenticatedActor } from "@/auth/actor";
import { getCharacterDetail } from "@/character/characters";
import { listChronicles } from "@/character/chronicles";
import { createInventoryAction } from "../actions";
import { InventoryForm } from "../inventory-form";
export default async function NewInventoryPage({ params }: { params: Promise<{ characterId: string }> }) { const { characterId } = await params; const actor = await getAuthenticatedActor(); if (!actor) redirect(`/sign-in?returnTo=/characters/${characterId}/inventory/new`); const character = await getCharacterDetail(actor, characterId); if (!character?.isOwner) notFound(); const chronicles = await listChronicles(characterId); return <main className="mx-auto min-h-screen max-w-2xl px-6 py-16"><Link className="text-sm text-brand hover:underline" href={`/characters/${characterId}`}>← {character.name}</Link><h1 className="mt-8 text-4xl font-semibold">Add inventory</h1><p className="mt-2 text-text-muted">Record current ownership only. This will not change credits or create a ledger entry.</p><InventoryForm characterId={characterId} chronicles={chronicles} action={createInventoryAction.bind(null, characterId)} /></main>; }
