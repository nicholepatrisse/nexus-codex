import { eq } from "drizzle-orm";
import type { AuthenticatedActor } from "@/auth/actor";
import { getDb } from "@/db/client";
import { characterOptions, playerMaterials } from "@/db/schema";
import { SUPPORTED_GAME_SYSTEM } from "@/game-system/config";
import { PLAYER_CORE } from "@/materials/materials";
import type { IdentityValidationContext } from "@/character/identity-validation";

export async function getIdentityValidationContext(actor: AuthenticatedActor, database = getDb()): Promise<IdentityValidationContext> {
  const [options, materials] = await Promise.all([
    database.select({ optionType: characterOptions.optionType, name: characterOptions.name, sourceMaterialIdentity: characterOptions.sourceMaterialIdentity, sourceMaterialTitle: characterOptions.sourceMaterialTitle, metadata: characterOptions.metadata }).from(characterOptions).where(eq(characterOptions.gameSystemId, SUPPORTED_GAME_SYSTEM.id)),
    database.select({ identity: playerMaterials.identity }).from(playerMaterials).where(eq(playerMaterials.personId, actor.personId)),
  ]);
  return {
    options: options.filter((option): option is IdentityValidationContext["options"][number] => option.optionType === "class" || option.optionType === "ancestry" || option.optionType === "background"),
    ownedMaterialIdentities: [PLAYER_CORE.identity, ...materials.map(({ identity }) => identity)],
  };
}
