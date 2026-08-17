"use client";

import { useState } from "react";
import { SignInButton } from "@/app/sign-in/sign-in-button";
import { authClient } from "@/auth/client";

export function AuthControls() {
  const { data: session, isPending } = authClient.useSession();
  const [signOutPending, setSignOutPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (isPending) {
    return <p className="text-sm text-[var(--muted)]">Checking your session…</p>;
  }

  if (!session) return <SignInButton />;

  async function signOut() {
    setSignOutPending(true);
    setError(null);
    const result = await authClient.signOut();
    if (result.error) {
      setError("Sign-out failed. Please try again.");
      setSignOutPending(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-4">
      <div>
        <p className="font-semibold text-white">Signed in as {session.user.name}</p>
        <p className="mt-1 text-sm text-[var(--muted)]">{session.user.email}</p>
      </div>
      <button
        className="rounded-full border border-white/20 bg-white/5 px-5 py-2 text-sm font-semibold text-white transition hover:bg-white/10 disabled:cursor-wait disabled:opacity-60"
        type="button"
        onClick={signOut}
        disabled={signOutPending}
      >
        {signOutPending ? "Signing out…" : "Sign out"}
      </button>
      {error ? (
        <p className="text-sm text-red-300" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
