import Link from "next/link";

export default function InvitationResultPage() {
  return <main className="mx-auto flex min-h-screen max-w-xl items-center px-6 py-20"><section className="w-full rounded-3xl border border-border bg-surface p-8"><h1 className="text-4xl font-semibold">Request received</h1><p className="mt-4 text-text-muted">Your membership request is awaiting review. You’ll gain access after an owner approves it.</p><Link href="/" className="mt-8 inline-flex text-brand hover:underline">Return home</Link></section></main>;
}
