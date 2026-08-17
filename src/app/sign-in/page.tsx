import { SignInButton } from "@/app/sign-in/sign-in-button";

interface SignInPageProps {
  searchParams: Promise<{ callbackURL?: string }>;
}

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const requestedCallback = (await searchParams).callbackURL;
  const callbackURL = requestedCallback?.startsWith("/")
    && !requestedCallback.startsWith("//")
    && !requestedCallback.includes("\\")
    ? requestedCallback
    : "/";

  return (
    <main className="mx-auto flex min-h-screen max-w-xl items-center px-6 py-20">
      <section className="w-full rounded-3xl border border-white/10 bg-black/20 p-8 sm:p-10">
        <h1 className="text-4xl font-semibold tracking-tight">Sign in</h1>
        <p className="mt-4 text-[var(--muted)]">Nexus Codex uses Google to verify your identity.</p>
        <div className="mt-8">
          <SignInButton callbackURL={callbackURL} />
        </div>
      </section>
    </main>
  );
}
