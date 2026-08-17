import { redirect } from "next/navigation";
import Link from "next/link";
import { getAuthenticatedActor } from "@/auth/actor";
import { CreateCommunityForm } from "@/app/communities/new/create-community-form";

export default async function NewCommunityPage() {
  const actor = await getAuthenticatedActor();
  if (!actor) redirect("/sign-in?callbackURL=%2Fcommunities%2Fnew");

  return (
    <main className="mx-auto min-h-screen max-w-2xl px-6 py-16 sm:py-24">
      <Link href="/" className="text-sm text-[var(--accent)] hover:underline">
        ← Nexus Codex
      </Link>
      <section className="mt-8 rounded-3xl border border-white/10 bg-black/20 p-7 shadow-2xl sm:p-10">
        <p className="text-sm font-semibold tracking-[0.2em] text-[var(--accent)] uppercase">
          New community
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight">Create your community</h1>
        <p className="mt-4 leading-7 text-[var(--muted)]">
          New communities start private, with member-only schedules and manually approved members
          and GMs. You can change those policies later.
        </p>
        <CreateCommunityForm />
      </section>
    </main>
  );
}
