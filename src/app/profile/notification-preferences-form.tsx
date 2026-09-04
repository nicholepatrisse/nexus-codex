"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import type { CommunityPreferenceKey } from "@/notifications/preferences";
import { updateNotificationPreferencesAction } from "./notification-preference-actions";

type Community = { communityId: string; communityName: string } & Record<CommunityPreferenceKey, boolean>;
type Preferences = { communities: Community[]; membershipStatus: boolean };
const categories: { key: CommunityPreferenceKey; title: string; description: string }[] = [
  { key: "newGames", title: "New games", description: "A game is published in a community." },
  { key: "membershipRequests", title: "Membership requests", description: "A request needs your review as an owner." },
  { key: "gmSignups", title: "Player signups", description: "A player signs up for a game you GM." },
  { key: "joinedGameChanges", title: "Changes to games I joined", description: "A game you joined is updated." },
  { key: "joinedGameCancellations", title: "Cancellations", description: "A game you joined is cancelled." },
];

function SaveButton() { const { pending } = useFormStatus(); return <button type="submit" disabled={pending} className="rounded-full bg-brand px-6 py-3 font-semibold text-on-brand disabled:opacity-60">{pending ? "Saving…" : "Save preferences"}</button>; }

function CommunityGroup({ category, communities, values, setValues }: { category: typeof categories[number]; communities: Community[]; values: Record<string, boolean>; setValues: (values: Record<string, boolean>) => void }) {
  const checkbox = useRef<HTMLInputElement>(null);
  const count = communities.filter(({ communityId }) => values[communityId]).length;
  const all = communities.length > 0 && count === communities.length;
  const some = count > 0 && !all;
  useEffect(() => { if (checkbox.current) checkbox.current.indeterminate = some; }, [some]);
  return <fieldset className="rounded-xl border border-border-strong bg-surface-raised"><legend className="sr-only">{category.title} by community</legend>
    <div className="flex items-start gap-3 p-4"><input ref={checkbox} id={`all-${category.key}`} type="checkbox" checked={all} onChange={(event) => setValues(Object.fromEntries(communities.map(({ communityId }) => [communityId, event.target.checked])))} className="mt-1 size-4 accent-brand"/><label htmlFor={`all-${category.key}`} className="cursor-pointer"><span className="block font-semibold">{category.title}</span><span className="mt-1 block text-sm text-text-muted">{category.description} {all ? "Enabled for all communities." : some ? `Enabled for ${count} of ${communities.length} communities.` : "Disabled for all communities."}</span></label></div>
    <details className="border-t border-border"><summary className="cursor-pointer px-4 py-3 text-sm font-semibold">Choose individual communities</summary><div className="space-y-1 border-t border-border p-2">{communities.map((community) => <label key={community.communityId} className="flex cursor-pointer gap-3 rounded-lg p-3 hover:bg-surface-hover"><input type="checkbox" name={category.key} value={community.communityId} checked={values[community.communityId] ?? false} onChange={(event) => setValues({ ...values, [community.communityId]: event.target.checked })} className="mt-1 size-4 accent-brand"/><span>{community.communityName}</span></label>)}</div></details>
  </fieldset>;
}

export function NotificationPreferencesForm({ preferences }: { preferences: Preferences }) {
  const [result, action] = useActionState(updateNotificationPreferencesAction, {});
  const [values, setValues] = useState<Record<CommunityPreferenceKey, Record<string, boolean>>>(() => Object.fromEntries(categories.map(({ key }) => [key, Object.fromEntries(preferences.communities.map((row) => [row.communityId, row[key]]))])) as Record<CommunityPreferenceKey, Record<string, boolean>>);
  return <section className="mt-8"><h2 className="text-2xl font-semibold">Notification preferences</h2><p className="mt-1 text-sm text-text-muted">Changes affect future notifications only. Existing notifications stay unchanged.</p>
    <form action={action} className="mt-6 space-y-5"><fieldset className="rounded-xl border border-border-strong bg-surface-raised p-4"><legend className="font-semibold">Account notifications</legend><label className="flex cursor-pointer gap-3"><input type="checkbox" name="membershipStatus" defaultChecked={preferences.membershipStatus} className="mt-1 size-4 accent-brand"/><span><span className="block font-semibold">Membership request status</span><span className="block text-sm text-text-muted">Updates when one of your community membership requests changes. This setting applies across your account.</span></span></label></fieldset>
      {preferences.communities.length ? <div className="space-y-4"><h3 className="text-lg font-semibold">Community notifications</h3>{categories.map((category) => <CommunityGroup key={category.key} category={category} communities={preferences.communities} values={values[category.key]} setValues={(next) => setValues((current) => ({ ...current, [category.key]: next }))}/>)}</div> : <p className="rounded-xl border border-border-strong bg-surface-raised p-4 text-text-muted">Join a community to manage community-specific notifications.</p>}
      {result.formError ? <p role="alert" className="rounded-xl bg-danger/10 p-4 text-danger">{result.formError}</p> : null}{result.saved ? <p role="status" className="rounded-xl bg-success/10 p-4 text-success">Notification preferences saved.</p> : null}<SaveButton /></form>
  </section>;
}
