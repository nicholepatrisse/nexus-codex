import { randomUUID } from "node:crypto";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getAuthenticatedActor } from "@/auth/actor";
import { getCharacterDetail } from "@/character/characters";
import { listChronicles } from "@/character/chronicles";
import { createInventoryAction } from "../actions";
import { InventoryForm } from "../inventory-form";
export default async function NewInventoryPage({ params }: { params: Promise<{ characterId: string }> }) { const { characterId } = await params; const actor = await getAuthenticatedActor(); if (!actor) redirect(`/sign-in?returnTo=/characters/${characterId}/inventory/new`); const character = await getCharacterDetail(actor, characterId); if (!character?.isOwner) notFound(); const chronicles = await listChronicles(characterId); return <main className="mx-auto min-h-screen max-w-2xl px-6 py-16"><Link className="text-sm text-brand hover:underline" href={`/characters/${characterId}`}>← {character.name}</Link><h1 className="mt-8 text-4xl font-semibold">Add item</h1><p className="mt-2 text-text-muted">Choose how the item was acquired. Purchased items debit credits; other items only update inventory.</p><InventoryForm characterId={characterId} chronicles={chronicles} idempotencyKey={randomUUID()} action={createInventoryAction.bind(null, characterId)} /></main>; }
