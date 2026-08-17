import { config } from "dotenv";

config({ path: [".env.local", ".env"], quiet: true });

const { seedSfs2Catalog } = await import("@/catalog/seed-sfs2");
const { closeDb } = await import("@/db/client");

try {
  const result = await seedSfs2Catalog();
  console.log(`Seeded ${result.itemCount} SFS2 catalog items.`);
} finally {
  await closeDb();
}
