import { redirect } from "next/navigation";
import { getAuthenticatedActor } from "@/auth/actor";
import { getProfile } from "@/profile/profile";
import { ProfileForm } from "./profile-form";

export default async function ProfilePage() {
  const actor = await getAuthenticatedActor();
  if (!actor) redirect("/sign-in?returnTo=%2Fprofile");
  const profile = await getProfile(actor);
  if (!profile) redirect("/sign-in");
  return <main className="mx-auto min-h-screen max-w-2xl px-6 py-16"><p className="text-sm font-semibold tracking-[0.2em] text-[var(--accent)] uppercase">Account</p><h1 className="mt-3 text-4xl font-semibold">Your profile</h1><p className="mt-3 text-[var(--muted)]">Signed in as {profile.email}. Add only the details you want to share in relevant play areas.</p><section className="mt-8 rounded-3xl border border-white/10 bg-black/20 p-8"><ProfileForm profile={profile} /></section></main>;
}
