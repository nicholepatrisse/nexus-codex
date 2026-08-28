import { redirect } from "next/navigation";
import { getAuthenticatedActor } from "@/auth/actor";
import { getProfile } from "@/profile/profile";
import { ProfileForm } from "./profile-form";

export default async function ProfilePage() {
  const actor = await getAuthenticatedActor();
  if (!actor) redirect("/sign-in?returnTo=%2Fprofile");
  const profile = await getProfile(actor);
  if (!profile) redirect("/sign-in");
  return <main className="page-shell mx-auto min-h-screen max-w-2xl"><p className="text-xs font-semibold tracking-[0.18em] text-brand uppercase sm:text-sm">Account</p><h1 className="responsive-title mt-2 font-semibold sm:mt-3">Your profile</h1><p className="mt-3 break-words text-text-muted">Signed in as {profile.email}. Add only the details you want to share in relevant play areas.</p><section className="responsive-card mt-6 rounded-3xl border border-border bg-surface sm:mt-8"><ProfileForm profile={profile} /></section></main>;
}
