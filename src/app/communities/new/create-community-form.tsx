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
      className="rounded-full bg-brand px-6 py-3 font-semibold text-background transition hover:bg-brand-hover disabled:cursor-wait disabled:opacity-60"
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
        <label htmlFor="name" className="block text-sm font-semibold text-text-primary">
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
          className="mt-2 w-full rounded-xl border border-border-strong bg-surface-raised px-4 py-3 text-text-primary outline-none transition placeholder:text-text-primary/35 focus:border-brand"
          placeholder="Absalom Station Lodge"
        />
        {state.fieldErrors?.name ? (
          <p id="name-error" role="alert" className="mt-2 text-sm text-danger">
            {state.fieldErrors.name[0]}
          </p>
        ) : null}
      </div>

      <div>
        <label htmlFor="requestedSlug" className="block text-sm font-semibold text-text-primary">
          Web address <span className="font-normal text-text-muted">(optional)</span>
        </label>
        <div className="mt-2 flex items-center rounded-xl border border-border-strong bg-surface-raised focus-within:border-brand">
          <span className="pl-4 text-sm text-text-muted">/communities/</span>
          <input
            id="requestedSlug"
            name="requestedSlug"
            type="text"
            maxLength={80}
            aria-describedby="slug-help"
            aria-invalid={Boolean(state.fieldErrors?.requestedSlug)}
            className="min-w-0 flex-1 bg-transparent px-1 py-3 pr-4 text-text-primary outline-none placeholder:text-text-primary/35"
            placeholder="absalom-station-lodge"
          />
        </div>
        <p id="slug-help" className="mt-2 text-sm text-text-muted">
          Leave blank to generate it from the community name. Conflicts receive a numeric suffix.
        </p>
        {state.fieldErrors?.requestedSlug ? (
          <p role="alert" className="mt-2 text-sm text-danger">
            {state.fieldErrors.requestedSlug[0]}
          </p>
        ) : null}
      </div>

      {state.formError ? (
        <p role="alert" className="rounded-xl border border-danger/30 bg-danger/10 p-4 text-danger">
          {state.formError}
        </p>
      ) : null}

      <div className="flex items-center gap-4">
        <SubmitButton />
        <Link href="/" className="text-sm text-text-muted hover:text-text-primary">
          Cancel
        </Link>
      </div>
    </form>
  );
}
