export default function CommunitiesLoading() {
  return (
    <main
      aria-busy="true"
      aria-label="Loading public communities"
      className="mx-auto min-h-screen max-w-5xl animate-pulse px-6 py-16 sm:py-24"
    >
      <div className="h-5 w-32 rounded bg-surface-raised" />
      <section className="mt-20" aria-hidden="true">
        <div className="h-4 w-48 rounded bg-brand/20" />
        <div className="mt-5 h-12 w-full max-w-xl rounded bg-surface-raised" />
        <div className="mt-5 h-6 w-full max-w-2xl rounded bg-surface" />
        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="h-40 rounded-2xl border border-border bg-surface" />
          ))}
        </div>
      </section>
    </main>
  );
}
