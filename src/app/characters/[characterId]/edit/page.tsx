import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getAuthenticatedActor } from "@/auth/actor";
import { getCharacterDetail } from "@/character/characters";
import { EditCharacterForm } from "./edit-character-form";
import { getIdentityValidationContext } from "@/character/identity-validation-context";
import { listOwnedChronicles } from "@/character/chronicles";
import { listOwnedCharacterOptionSelections } from "@/character/option-selections";

export default async function EditCharacterPage({ params }: { params: Promise<{ characterId: string }> }) {
  const { characterId } = await params;
  const actor = await getAuthenticatedActor();
  if (!actor) redirect(`/sign-in?returnTo=${encodeURIComponent(`/characters/${characterId}/edit`)}`);
  const [character, validationContext, chronicles, selections] = await Promise.all([getCharacterDetail(actor, characterId), getIdentityValidationContext(actor), listOwnedChronicles(actor), listOwnedCharacterOptionSelections(actor, characterId)]);
  if (!character || !character.isOwner) notFound();
  const characterOptions = (selections ?? []).map((selection) => ({ key: selection.id, selectionKind: selection.selectionKind as "heritage" | "feat", name: selection.nameSnapshot, acquiredLevel: selection.acquiredLevel, featCategory: selection.featCategory as "class" | "ancestry" | "skill" | "general" | null, acquisitionMethod: (selection.acquisitionMethod ?? "selected") as "selected" | "awarded", grantOrigin: selection.grantOrigin ?? "", characterOptionId: selection.characterOptionId, sourceMaterialIdentity: selection.sourceMaterialIdentitySnapshot, sourceMaterialTitle: selection.sourceMaterialTitleSnapshot, sourceUrl: selection.sourceUrlSnapshot }));
  return <main className="page-shell mx-auto min-h-screen max-w-2xl"><Link href={`/characters/${character.id}`} className="text-sm text-brand hover:underline">← Character details</Link><h1 className="responsive-title mt-6 break-words font-semibold sm:mt-8">Edit {character.name}</h1><p className="mt-3 text-text-muted">Update the details players and authorized GMs see.</p><EditCharacterForm character={character} validationContext={validationContext} chronicles={chronicles} characterOptions={characterOptions} /></main>;
}
