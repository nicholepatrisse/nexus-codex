"use client";

import { useState } from "react";
import { authClient } from "@/auth/client";

export function SignInButton({ callbackURL = "/" }: { callbackURL?: string }) {
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
    <div>
      <button type="button" onClick={signIn} disabled={pending}>
        {pending ? "Opening Google…" : "Continue with Google"}
      </button>
      {error ? <p role="alert">{error}</p> : null}
    </div>
  );
}
