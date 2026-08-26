"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SignInButton } from "@/app/sign-in/sign-in-button";
import { authClient } from "@/auth/client";
import { signOutAndRedirect } from "@/auth/sign-out";

export function AuthControls() {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();
  const [signOutPending, setSignOutPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (isPending) {
    return <p className="text-sm text-text-muted">Checking your session…</p>;
  }

  if (!session) return <SignInButton />;

  async function signOut() {
    setSignOutPending(true);
    setError(null);
    const result = await signOutAndRedirect(
      () => authClient.signOut(),
      (href) => router.replace(href),
    );
    if (result.error) {
      setError("Sign-out failed. Please try again.");
      setSignOutPending(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-4">
      <div>
        <p className="font-semibold text-text-primary">Signed in as {session.user.name}</p>
        <p className="mt-1 text-sm text-text-muted">{session.user.email}</p>
      </div>
      <button
        className="rounded-full border border-border-strong bg-surface-raised px-5 py-2 text-sm font-semibold text-text-primary transition hover:bg-surface-hover disabled:cursor-wait disabled:opacity-60"
        type="button"
        onClick={signOut}
        disabled={signOutPending}
      >
        {signOutPending ? "Signing out…" : "Sign out"}
      </button>
      {error ? (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
