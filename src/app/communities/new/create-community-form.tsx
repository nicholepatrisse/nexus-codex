"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import {
  createCommunityAction,
  type CreateCommunityFormState,
} from "@/app/communities/new/actions";

const initialCreateCommunityFormState: CreateCommunityFormState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-full bg-[var(--accent)] px-6 py-3 font-semibold text-[#07110f] transition hover:brightness-110 disabled:cursor-wait disabled:opacity-60"
    >
      {pending ? "Creating…" : "Create community"}
    </button>
  );
}

export function CreateCommunityForm() {
  const [state, formAction] = useActionState(
    createCommunityAction,
    initialCreateCommunityFormState,
  );

  return (
    <form action={formAction} className="mt-10 space-y-7" noValidate>
      <div>
        <label htmlFor="name" className="block text-sm font-semibold text-white">
          Community name
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          maxLength={120}
          autoComplete="organization"
          aria-describedby={state.fieldErrors?.name ? "name-error" : undefined}
          aria-invalid={Boolean(state.fieldErrors?.name)}
          className="mt-2 w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-white outline-none transition placeholder:text-white/35 focus:border-[var(--accent)]"
          placeholder="Absalom Station Lodge"
        />
        {state.fieldErrors?.name ? (
          <p id="name-error" role="alert" className="mt-2 text-sm text-red-300">
            {state.fieldErrors.name[0]}
          </p>
        ) : null}
      </div>

      <div>
        <label htmlFor="requestedSlug" className="block text-sm font-semibold text-white">
          Web address <span className="font-normal text-[var(--muted)]">(optional)</span>
        </label>
        <div className="mt-2 flex items-center rounded-xl border border-white/15 bg-white/5 focus-within:border-[var(--accent)]">
          <span className="pl-4 text-sm text-[var(--muted)]">/communities/</span>
          <input
            id="requestedSlug"
            name="requestedSlug"
            type="text"
            maxLength={80}
            aria-describedby="slug-help"
            aria-invalid={Boolean(state.fieldErrors?.requestedSlug)}
            className="min-w-0 flex-1 bg-transparent px-1 py-3 pr-4 text-white outline-none placeholder:text-white/35"
            placeholder="absalom-station-lodge"
          />
        </div>
        <p id="slug-help" className="mt-2 text-sm text-[var(--muted)]">
          Leave blank to generate it from the community name. Conflicts receive a numeric suffix.
        </p>
        {state.fieldErrors?.requestedSlug ? (
          <p role="alert" className="mt-2 text-sm text-red-300">
            {state.fieldErrors.requestedSlug[0]}
          </p>
        ) : null}
      </div>

      {state.formError ? (
        <p role="alert" className="rounded-xl border border-red-300/30 bg-red-400/10 p-4 text-red-200">
          {state.formError}
        </p>
      ) : null}

      <div className="flex items-center gap-4">
        <SubmitButton />
        <Link href="/" className="text-sm text-[var(--muted)] hover:text-white">
          Cancel
        </Link>
      </div>
    </form>
  );
}
