import Link from "next/link";
import { AccentSurface, OrbitMotif, SparkAccent, accentPosition } from "@/app/accent-primitives";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[70vh] max-w-3xl items-center px-6 py-20">
      <AccentSurface
        className="w-full rounded-2xl px-8 py-12 shadow-2xl sm:px-12"
        style={accentPosition("88%", "18%")}
      >
        <OrbitMotif className="pointer-events-none absolute -top-6 -right-14 w-72 opacity-30" />
        <section className="relative" aria-labelledby="not-found-title">
          <p className="flex items-center gap-2 text-sm font-semibold tracking-[0.24em] text-brand uppercase">
            <SparkAccent className="shrink-0" size={14} />
            Error 404
          </p>
          <h1 id="not-found-title" className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
            Page not found
          </h1>
          <p className="mt-4 max-w-xl leading-7 text-text-muted">
            The page you requested doesn’t exist or may have moved. Return home to continue using
            Nexus Codex.
          </p>
          <div className="mt-8">
            <Link
              href="/"
              className="inline-flex rounded-md bg-brand px-5 py-3 font-semibold text-on-brand hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              Return home
            </Link>
          </div>
        </section>
      </AccentSurface>
    </main>
  );
}
