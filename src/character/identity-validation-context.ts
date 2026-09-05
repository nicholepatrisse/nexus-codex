import { eq } from "drizzle-orm";
import type { AuthenticatedActor } from "@/auth/actor";
import { getDb } from "@/db/client";
import { characterOptions } from "@/db/schema";
import { SUPPORTED_GAME_SYSTEM } from "@/game-system/config";
import { listOwnedMaterialIdentities } from "@/materials/materials";
import type { IdentityValidationContext } from "@/character/identity-validation";

export async function getIdentityValidationContext(actor: AuthenticatedActor, database = getDb()): Promise<IdentityValidationContext> {
  const [options, ownedMaterialIdentities] = await Promise.all([
    database.select({ id: characterOptions.id, optionType: characterOptions.optionType, name: characterOptions.name, sourceMaterialIdentity: characterOptions.sourceMaterialIdentity, sourceMaterialTitle: characterOptions.sourceMaterialTitle, sourceUrl: characterOptions.sourceUrl, metadata: characterOptions.metadata }).from(characterOptions).where(eq(characterOptions.gameSystemId, SUPPORTED_GAME_SYSTEM.id)),
    listOwnedMaterialIdentities(actor, database),
  ]);
  return {
    options: options.filter((option) => ["class", "ancestry", "background", "heritage", "feat"].includes(option.optionType)).map((option) => ({ ...option, optionType: option.optionType as IdentityValidationContext["options"][number]["optionType"] })),
    ownedMaterialIdentities,
  };
}
