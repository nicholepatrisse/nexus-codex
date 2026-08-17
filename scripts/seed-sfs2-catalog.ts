import { seedSfs2Catalog } from "@/catalog/seed-sfs2";
import { closeDb } from "@/db/client";

try {
  const result = await seedSfs2Catalog();
  console.log(`Seeded ${result.itemCount} SFS2 catalog items.`);
} finally {
  await closeDb();
}
