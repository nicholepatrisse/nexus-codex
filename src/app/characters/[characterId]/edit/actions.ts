"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { AuthenticationRequiredError, requireAuthenticatedActor } from "@/auth/actor";
import { InvalidAncestryChronicleError, StartingLevelLockedError, updateCharacter, updateCharacterInputSchema } from "@/character/characters";
import { characterOptionSelectionInputSchema, replaceCharacterOptionSelections } from "@/character/option-selections";

export interface EditCharacterFormState { fieldErrors?: Record<string, string[] | undefined>; formError?: string }

export async function updateCharacterAction(characterId: string, _state: EditCharacterFormState, formData: FormData): Promise<EditCharacterFormState> {
  const startingLevel = formData.get("startingLevel");
  const startingItems = formData.get("startingItems");
  let parsedStartingItems: unknown;
  try { parsedStartingItems = typeof startingItems === "string" ? JSON.parse(startingItems) : undefined; } catch { parsedStartingItems = "invalid"; }
  let characterOptions: unknown;
  try { characterOptions = JSON.parse(String(formData.get("characterOptions") ?? "[]")); } catch { return { fieldErrors: { characterOptions: ["The heritage and feat selections could not be read."] } }; }
  const parsedOptions = z.array(characterOptionSelectionInputSchema).max(100).safeParse(characterOptions);
  if (!parsedOptions.success) return { fieldErrors: { characterOptions: parsedOptions.error.issues.map(({ message }) => message) } };
  const parsed = updateCharacterInputSchema.safeParse({ name: formData.get("name"), startingLevel: startingLevel ?? undefined, startingCredits: formData.get("startingCredits") ?? undefined, startingItems: parsedStartingItems, className: formData.get("className"), classValidationNote: formData.get("classValidationNote"), ancestry: formData.get("ancestry"), ancestryValidationNote: formData.get("ancestryValidationNote"), ancestrySourceChronicleId: formData.get("ancestrySourceChronicleId"), background: formData.get("background"), backgroundValidationNote: formData.get("backgroundValidationNote"), backgroundSourceChronicleId: formData.get("backgroundSourceChronicleId"), backstory: formData.get("backstory"), notes: formData.get("notes") });
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors };
  try {
    const actor = await requireAuthenticatedActor();
    const updated = await updateCharacter(actor, characterId, parsed.data);
    if (!updated) return { formError: "You do not have permission to edit this character." };
    if (!await replaceCharacterOptionSelections(actor, characterId, parsedOptions.data)) return { formError: "You do not have permission to edit this character." };
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) return { formError: "Your session expired. Sign in and try again." };
    if (error instanceof StartingLevelLockedError) return { fieldErrors: { startingLevel: [error.message] } };
    if (error instanceof InvalidAncestryChronicleError) return { fieldErrors: { [error.message.startsWith("The background") ? "backgroundSourceChronicleId" : "ancestrySourceChronicleId"]: [error.message] } };
    return { formError: "We couldn’t update that character. Please try again." };
  }
  redirect(`/characters/${characterId}`);
}
