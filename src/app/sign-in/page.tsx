import { AccentDivider, AccentSurface, OrbitMotif, SparkAccent } from "@/app/accent-primitives";
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
      <AccentSurface className="w-full rounded-3xl p-8 sm:p-10">
        <OrbitMotif className="pointer-events-none absolute -top-9 -right-20 w-72 opacity-25" />
        <section className="relative">
          <SparkAccent className="mb-5" />
          <h1 className="text-4xl font-semibold tracking-tight">Sign in</h1>
          <p className="mt-4 text-text-muted">Nexus Codex uses Google to verify your identity.</p>
          <AccentDivider className="my-8" />
          <SignInButton callbackURL={callbackURL} />
        </section>
      </AccentSurface>
    </main>
  );
}
