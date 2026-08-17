import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { getServerEnvironment } from "@/env";

let database: PostgresJsDatabase | undefined;

export function getDb(): PostgresJsDatabase {
  database ??= drizzle(postgres(getServerEnvironment().DATABASE_URL, { max: 10, prepare: false }));
  return database;
}
