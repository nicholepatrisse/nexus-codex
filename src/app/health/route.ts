import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db/client";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await getDb().execute(sql`select 1`);
    return NextResponse.json({ database: "up", status: "ok" });
  } catch {
    return NextResponse.json({ database: "down", status: "error" }, { status: 503 });
  }
}
