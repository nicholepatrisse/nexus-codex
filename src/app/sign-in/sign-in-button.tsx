"use client";

import { useState } from "react";
import { authClient } from "@/auth/client";

export function SignInButton() {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function signIn() {
    setPending(true);
    setError(null);
    const result = await authClient.signIn.social({ provider: "google", callbackURL: "/" });
    if (result.error) {
      setError("Google sign-in could not be started. Please try again.");
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-3">
      <button
        className="rounded-full bg-[var(--accent)] px-6 py-3 font-semibold text-[#07110f] transition hover:brightness-110 disabled:cursor-wait disabled:opacity-60"
        type="button"
        onClick={signIn}
        disabled={pending}
      >
        {pending ? "Opening Google…" : "Continue with Google"}
      </button>
      {error ? (
        <p className="text-sm text-red-300" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
