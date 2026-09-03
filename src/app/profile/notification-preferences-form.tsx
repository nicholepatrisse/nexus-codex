"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { updateNotificationPreferencesAction } from "./notification-preference-actions";

function SaveButton() {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} className="rounded-full bg-brand px-6 py-3 font-semibold text-on-brand disabled:opacity-60">{pending ? "Saving…" : "Save preferences"}</button>;
}

type CommunityPreference = { communityId: string; communityName: string; enabled: boolean };

function preferenceState(preferences: CommunityPreference[]) {
  return Object.fromEntries(preferences.map(({ communityId, enabled }) => [communityId, enabled]));
}

export function NotificationPreferencesForm({ preferences }: { preferences: CommunityPreference[] }) {
  const [state, action] = useActionState(updateNotificationPreferencesAction, {});
  const [enabledByCommunity, setEnabledByCommunity] = useState<Record<string, boolean>>(() => preferenceState(preferences));
  const allCheckbox = useRef<HTMLInputElement>(null);
  const enabledCount = preferences.filter(({ communityId }) => enabledByCommunity[communityId]).length;
  const allEnabled = enabledCount === preferences.length;
  const someEnabled = enabledCount > 0 && !allEnabled;

  useEffect(() => {
    if (allCheckbox.current) allCheckbox.current.indeterminate = someEnabled;
  }, [someEnabled]);

  useEffect(() => {
    if (!state.enabledCommunityIds) return;
    const enabledIds = new Set(state.enabledCommunityIds);
    // A server action refresh can reset form controls before React receives the saved values.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEnabledByCommunity(Object.fromEntries(preferences.map(({ communityId }) => [communityId, enabledIds.has(communityId)])));
  }, [state.enabledCommunityIds, preferences]);

  function toggleAll(enabled: boolean) {
    setEnabledByCommunity(Object.fromEntries(preferences.map(({ communityId }) => [communityId, enabled])));
  }

  return <section className="mt-8">
    <h2 className="text-2xl font-semibold">Notification preferences</h2>
    <p className="mt-1 text-sm text-text-muted">Choose which announcements appear in your notifications.</p>
    {preferences.length === 0 ? <p className="mt-6 rounded-xl border border-border-strong bg-surface-raised p-4 text-text-muted">Join a community to manage its notifications.</p> : <form action={action} className="mt-6 space-y-6">
      <fieldset><legend className="sr-only">New game notifications by community</legend>
        <div className="rounded-xl border border-border-strong bg-surface-raised">
          <div className="flex items-start gap-3 p-4">
            <input ref={allCheckbox} id="all-community-notifications" type="checkbox" checked={allEnabled} onChange={(event) => toggleAll(event.target.checked)} className="mt-1 size-4 accent-brand" />
            <label htmlFor="all-community-notifications" className="min-w-0 flex-1 cursor-pointer">
              <span className="block font-semibold">New games in my communities</span>
              <span className="mt-1 block text-sm text-text-muted">{allEnabled ? "Enabled for all communities." : someEnabled ? `Enabled for ${enabledCount} of ${preferences.length} communities.` : "Disabled for all communities."}</span>
            </label>
          </div>
          <details className="group border-t border-border">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold marker:hidden focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">
              Choose individual communities
              <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-4 transition-transform group-open:rotate-180"><path strokeLinecap="round" strokeLinejoin="round" d="m5 7.5 5 5 5-5" /></svg>
            </summary>
            <div className="space-y-1 border-t border-border p-2">{preferences.map((preference) =>
              <label key={preference.communityId} className="flex cursor-pointer items-start gap-3 rounded-lg p-3 hover:bg-surface-hover">
                <input type="checkbox" name="enabledCommunityId" value={preference.communityId} checked={enabledByCommunity[preference.communityId] ?? false} onChange={(event) => setEnabledByCommunity((current) => ({ ...current, [preference.communityId]: event.target.checked }))} className="mt-1 size-4 accent-brand" />
                <span><span className="block font-semibold">{preference.communityName}</span><span className="mt-1 block text-sm text-text-muted">New game announcements</span></span>
              </label>)}</div>
          </details>
        </div>
      </fieldset>
      {state.formError ? <p role="alert" className="rounded-xl bg-danger/10 p-4 text-danger">{state.formError}</p> : null}
      {state.saved ? <p role="status" className="rounded-xl bg-success/10 p-4 text-success">Notification preferences saved.</p> : null}
      <SaveButton />
    </form>}
  </section>;
}
