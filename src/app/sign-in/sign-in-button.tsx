"use client";

import { useState } from "react";
import { authClient } from "@/auth/client";

export function SignInButton({
  callbackURL = "/",
  label = "Continue with Google",
}: {
  callbackURL?: string;
  label?: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function signIn() {
    setPending(true);
    setError(null);
    const result = await authClient.signIn.social({ provider: "google", callbackURL });
    if (result.error) {
      setError("Google sign-in could not be started. Please try again.");
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-3">
      <button
        className="rounded-full bg-brand px-6 py-3 font-semibold text-on-brand transition hover:bg-brand-hover disabled:cursor-wait disabled:opacity-60"
        type="button"
        onClick={signIn}
        disabled={pending}
      >
        {pending ? "Opening Google…" : label}
      </button>
      {error ? (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
