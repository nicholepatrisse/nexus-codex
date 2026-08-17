import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { getDatabaseUrl } from "@/env";
import * as schema from "@/db/schema";

let database: PostgresJsDatabase<typeof schema> | undefined;
let client: ReturnType<typeof postgres> | undefined;

export function getDb(): PostgresJsDatabase<typeof schema> {
  client ??= postgres(getDatabaseUrl(), { max: 10, prepare: false });
  database ??= drizzle(client, { schema });
  return database;
}

export async function closeDb(): Promise<void> {
  await client?.end({ timeout: 5 });
  client = undefined;
  database = undefined;
}
