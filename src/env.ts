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

export type ServerEnvironment = z.infer<typeof serverEnvironmentSchema>;
let environment: ServerEnvironment | undefined;

export function getServerEnvironment(): ServerEnvironment {
  environment ??= serverEnvironmentSchema.parse(process.env);
  return environment;
}
