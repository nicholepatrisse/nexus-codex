"use client";
import { useActionState } from "react";
import { addMaterialAction, type MaterialActionState } from "./material-actions";

type Material = { id: string; title: string; productCode: string | null; sourceUrl: string; isDefault: boolean };
export function MaterialsOwned({ materials, removeAction }: { materials: Material[]; removeAction: (id: string) => Promise<void> }) {
  const [state, action, pending] = useActionState<MaterialActionState, FormData>(addMaterialAction, {});
  return <section><h2 className="text-2xl font-semibold">Materials owned</h2><p className="mt-1 text-sm text-text-muted">Nexus uses these sources to advise whether imported character options are available to you.</p>
    <ul className="mt-5 divide-y divide-border border-b border-border">{materials.map((material) => <li key={material.id} className="flex items-center justify-between gap-4 py-4"><div><a href={material.sourceUrl} target="_blank" rel="noreferrer" className="font-semibold text-brand hover:underline">{material.title}</a><p className="mt-1 text-xs text-text-muted">{material.productCode ?? "Paizo product"}{material.isDefault ? " · Included for every player" : ""}</p></div>{material.isDefault ? <span className="rounded-full border border-success/30 px-3 py-1 text-xs text-success">Default</span> : <form action={() => removeAction(material.id)}><button className="text-sm font-semibold text-danger hover:underline">Remove</button></form>}</li>)}</ul>
    <form action={action} className="pt-5"><label htmlFor="material-source-url" className="text-sm font-semibold">Add a Paizo product</label><div className="mt-2 flex gap-2"><input id="material-source-url" name="sourceUrl" type="url" required placeholder="https://store.paizo.com/product-name/" className="min-w-0 flex-1 rounded-xl border border-border-strong bg-surface-raised px-4 py-3 outline-none focus:border-brand"/><button disabled={pending} className="rounded-full bg-brand px-5 py-2.5 font-semibold text-on-brand disabled:opacity-60">{pending ? "Adding…" : "Add"}</button></div>{state.error ? <p role="alert" className="mt-2 text-sm text-danger">{state.error}</p> : null}{state.added ? <p role="status" className="mt-2 text-sm text-success">Material added.</p> : null}</form>
  </section>;
}
