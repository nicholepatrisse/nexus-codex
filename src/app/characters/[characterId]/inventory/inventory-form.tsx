"use client";
import Link from "next/link";
import { useActionState, useState, useTransition } from "react";
import type { InventoryFormState } from "./actions";
import type { InventoryEntry } from "@/character/inventory";
import { InventorySelect } from "./inventory-select";
import { fetchNethysItemAction } from "./nethys-actions";

type ChronicleOption = { id: string; scenarioNumberSnapshot: string; scenarioNameSnapshot: string };
const initial: InventoryFormState = {};
function ErrorText({ errors }: { errors?: string[] }) { return errors?.length ? <p className="mt-1 text-sm text-danger">{errors[0]}</p> : null; }
export function InventoryForm({ characterId, entry, chronicles, idempotencyKey, action }: { characterId: string; entry?: InventoryEntry; chronicles: ChronicleOption[]; idempotencyKey?: string; action: (state: InventoryFormState, data: FormData) => Promise<InventoryFormState> }) {
  const [state, formAction, pending] = useActionState(action, initial);
  const [acquisitionType, setAcquisitionType] = useState(entry?.acquisitionType ?? "other");
  const [itemName, setItemName] = useState(entry?.itemNameSnapshot ?? "");
  const [itemLink, setItemLink] = useState(entry?.itemLinkSnapshot ?? "");
  const [notes, setNotes] = useState(entry?.notes ?? "");
  const [bulk, setBulk] = useState(entry?.bulkSnapshot ?? "");
  const [quantity, setQuantity] = useState(String(entry?.quantity ?? 1));
  const [unitPrice, setUnitPrice] = useState("");
  const [totalPrice, setTotalPrice] = useState("");
  const [lookupError, setLookupError] = useState<string>();
  const [lookupMessage, setLookupMessage] = useState<string>();
  const [lookingUp, startLookup] = useTransition();
  function lookupNethys() {
    setLookupError(undefined); setLookupMessage(undefined);
    startLookup(async () => {
      const result = await fetchNethysItemAction(itemLink);
      if (!result.ok) { setLookupError(result.error); return; }
      const item = result.item;
      setItemName(item.name); setItemLink(item.url); setNotes(result.notes); setBulk(item.bulk ?? "");
      if (item.priceCredits != null) { const price = String(item.priceCredits); setUnitPrice(price); setTotalPrice(String(item.priceCredits * (Number(quantity) || 1))); }
      setLookupMessage("Details fetched. Review and edit them before saving.");
    });
  }
  const field = "mt-1 min-h-12 w-full rounded-xl border border-border-strong bg-surface px-4 py-2.5";
  const acquisitionOptions = [{ value: "starting_equipment", label: "Starting equipment" }, { value: "purchased", label: "Purchased" }, { value: "crafted", label: "Crafted" }, { value: "boon_reward", label: "Boon reward" }, { value: "other", label: "Other" }];
  const chronicleOptions = [{ value: "", label: "No Chronicle" }, ...chronicles.map((chronicle) => ({ value: chronicle.id, label: `${chronicle.scenarioNumberSnapshot} — ${chronicle.scenarioNameSnapshot}` }))];
  return <form action={formAction} className="mt-8 space-y-5">
    <input type="hidden" name="contentItemId" value={entry?.contentItemId ?? ""} />
    {idempotencyKey ? <input type="hidden" name="idempotencyKey" value={idempotencyKey} /> : null}
    <div><label className="text-sm font-semibold" htmlFor="itemName">Item name</label><input className={field} id="itemName" name="itemName" required maxLength={200} value={itemName} onChange={(event) => setItemName(event.target.value)} /><ErrorText errors={state.fieldErrors?.itemName} /></div>
    <div><label className="text-sm font-semibold" htmlFor="itemLink">Item link <span className="font-normal text-text-muted">(optional)</span></label><div className="flex items-start gap-2"><input className={field} id="itemLink" name="itemLink" type="url" inputMode="url" maxLength={2000} placeholder="https://2e.aonsrd.com/treasure/…" value={itemLink} onChange={(event) => setItemLink(event.target.value)} /><button className="mt-1 shrink-0 rounded-xl border border-border-strong px-4 py-2 font-semibold disabled:opacity-60" type="button" disabled={lookingUp || !itemLink.trim()} onClick={lookupNethys}>{lookingUp ? "Fetching…" : "Fetch details"}</button></div><p className="mt-1 text-sm text-text-muted">Paste a Starfinder 2e Archives of Nethys item URL to autofill available details.</p><ErrorText errors={state.fieldErrors?.itemLink} />{lookupError ? <p role="alert" className="mt-1 text-sm text-danger">{lookupError}</p> : null}{lookupMessage ? <p role="status" className="mt-1 text-sm text-success">{lookupMessage}</p> : null}</div>
    <div className="grid gap-5 sm:grid-cols-3"><div><label className="text-sm font-semibold" htmlFor="quantity">Quantity</label><input className={field} id="quantity" name="quantity" type="number" min="1" step="1" required value={quantity} onChange={(event) => setQuantity(event.target.value)} /><ErrorText errors={state.fieldErrors?.quantity} /></div><div><label className="text-sm font-semibold" htmlFor="bulk">Bulk <span className="font-normal text-text-muted">(each)</span></label><input className={field} id="bulk" name="bulk" maxLength={20} placeholder="—, L, 1…" value={bulk} onChange={(event) => setBulk(event.target.value)} /><ErrorText errors={state.fieldErrors?.bulk} /></div><div><label className="text-sm font-semibold" htmlFor="acquisitionType">Acquisition</label><InventorySelect name="acquisitionType" defaultValue={entry?.acquisitionType ?? "other"} options={acquisitionOptions} invalid={Boolean(state.fieldErrors?.acquisitionType)} onValueChange={setAcquisitionType} /></div></div>
    <div><label className="text-sm font-semibold" htmlFor="acquiredOn">Acquired on</label><input className={field} id="acquiredOn" name="acquiredOn" type="date" required defaultValue={entry?.acquiredOn ?? new Date().toISOString().slice(0,10)} /><ErrorText errors={state.fieldErrors?.acquiredOn} /></div>
    {!entry && acquisitionType === "purchased" ? <><div className="grid gap-5 sm:grid-cols-2"><div><label className="text-sm font-semibold" htmlFor="unitPriceMinor">Unit price <span className="font-normal text-text-muted">(credits)</span></label><input className={field} id="unitPriceMinor" name="unitPriceMinor" type="number" min="1" step="1" required value={unitPrice} onChange={(event) => setUnitPrice(event.target.value)} /><ErrorText errors={state.fieldErrors?.unitPriceMinor} /></div><div><label className="text-sm font-semibold" htmlFor="totalPriceMinor">Total paid <span className="font-normal text-text-muted">(credits)</span></label><input className={field} id="totalPriceMinor" name="totalPriceMinor" type="number" min="1" step="1" required value={totalPrice} onChange={(event) => setTotalPrice(event.target.value)} /><ErrorText errors={state.fieldErrors?.totalPriceMinor} /></div></div><p className="text-sm text-text-muted">The total must equal unit price × quantity. Saving will add inventory and debit credits together.</p></> : entry ? <div><label className="text-sm font-semibold" htmlFor="amountPaidMinor">Exact amount paid <span className="font-normal text-text-muted">(optional credits)</span></label><input className={field} id="amountPaidMinor" name="amountPaidMinor" type="number" min="0" step="1" defaultValue={entry.amountPaidMinor ?? ""} /><ErrorText errors={state.fieldErrors?.amountPaidMinor} /></div> : null}
    <div><label className="text-sm font-semibold" htmlFor="sourceChronicleId">Source Chronicle <span className="font-normal text-text-muted">(optional)</span></label><InventorySelect name="sourceChronicleId" defaultValue={entry?.sourceChronicleId ?? ""} options={chronicleOptions} invalid={Boolean(state.fieldErrors?.sourceChronicleId)} /><ErrorText errors={state.fieldErrors?.sourceChronicleId} /></div>
    <div><label className="text-sm font-semibold" htmlFor="notes">Notes <span className="font-normal text-text-muted">(optional)</span></label><textarea className={field} id="notes" name="notes" rows={8} maxLength={5000} value={notes} onChange={(event) => setNotes(event.target.value)} /><ErrorText errors={state.fieldErrors?.notes} /></div>
    {state.formError ? <p className="rounded-xl border border-danger/40 bg-danger/10 p-3 text-sm text-danger">{state.formError}</p> : null}
    <div className="flex gap-3"><button disabled={pending} className="rounded-full bg-brand px-5 py-2.5 font-semibold text-white disabled:opacity-60">{pending ? "Saving…" : "Save inventory entry"}</button><Link className="rounded-full border border-border-strong px-5 py-2.5 font-semibold" href={`/characters/${characterId}`}>Cancel</Link></div>
  </form>;
}
