import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { getServerEnvironment } from "@/env";
import * as schema from "@/db/schema";

let database: PostgresJsDatabase<typeof schema> | undefined;

export function getDb(): PostgresJsDatabase<typeof schema> {
  database ??= drizzle(postgres(getServerEnvironment().DATABASE_URL, { max: 10, prepare: false }), { schema });
  return database;
}
