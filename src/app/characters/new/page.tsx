import { redirect } from "next/navigation";
import { getAuthenticatedActor } from "@/auth/actor";
import { listGameSystems } from "@/character/characters";
import { getProfile } from "@/profile/profile";
import { SocietyNumberGate } from "./society-number-gate";

export default async function NewCharacterPage() {
  const actor = await getAuthenticatedActor();
  if (!actor) redirect("/sign-in?returnTo=%2Fcharacters%2Fnew");
  const [systems, profile] = await Promise.all([listGameSystems(), getProfile(actor)]);
  const societyPlayNumber = profile?.societyPlayNumber?.match(/^\d+$/)?.[0] ?? "";
  return <main className="mx-auto min-h-screen max-w-2xl px-6 py-16">
    <p className="text-sm font-semibold tracking-[0.2em] text-[var(--accent)] uppercase">Characters</p>
    <h1 className="mt-3 text-4xl font-semibold">Add a character</h1>
    <p className="mt-3 text-[var(--muted)]">Create a character attached to your account.</p>
    {systems.length ? <SocietyNumberGate systems={systems} initialSocietyPlayNumber={societyPlayNumber} /> : <p role="alert" className="mt-8 rounded-xl bg-amber-400/10 p-4 text-amber-100">No game systems are available yet.</p>}
  </main>;
}
