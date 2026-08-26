import { redirect } from "next/navigation";
import { getAuthenticatedActor } from "@/auth/actor";
import { RedeemInvitationForm } from "./redeem-form";

export default async function InvitationPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const actor = await getAuthenticatedActor();
  const invitationPath = `/invitations/${encodeURIComponent(token)}`;
  if (!actor) redirect(`/sign-in?callbackURL=${encodeURIComponent(invitationPath)}`);

  return <main className="mx-auto flex min-h-screen max-w-xl items-center px-6 py-20"><section className="w-full rounded-3xl border border-border bg-surface p-8"><p className="text-sm font-semibold tracking-[0.2em] text-brand uppercase">Community invitation</p><h1 className="mt-3 text-4xl font-semibold">Accept invitation</h1><p className="mt-4 text-text-muted">Continue to request or receive membership. For your privacy, invitation details are shown only after acceptance.</p><RedeemInvitationForm token={token} /></section></main>;
}
