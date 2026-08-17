import { z } from "zod";

const serverEnvironmentSchema = z.object({
  DATABASE_URL: z.url().refine((value) => value.startsWith("postgresql://"), {
    message: "DATABASE_URL must use the postgresql:// scheme",
  }),
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.url(),
  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),
});

const databaseUrlSchema = serverEnvironmentSchema.shape.DATABASE_URL;

export type ServerEnvironment = z.infer<typeof serverEnvironmentSchema>;
let environment: ServerEnvironment | undefined;
let databaseUrl: string | undefined;

export function getDatabaseUrl(): string {
  databaseUrl ??= databaseUrlSchema.parse(process.env.DATABASE_URL);
  return databaseUrl;
}

export function getServerEnvironment(): ServerEnvironment {
  environment ??= serverEnvironmentSchema.parse(process.env);
  return environment;
}
