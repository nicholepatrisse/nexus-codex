import { z } from "zod";

const serverEnvironmentSchema = z.object({
  DATABASE_URL: z.url().refine((value) => value.startsWith("postgresql://"), {
    message: "DATABASE_URL must use the postgresql:// scheme",
  }),
});

export type ServerEnvironment = z.infer<typeof serverEnvironmentSchema>;
let environment: ServerEnvironment | undefined;

export function getServerEnvironment(): ServerEnvironment {
  environment ??= serverEnvironmentSchema.parse(process.env);
  return environment;
}
