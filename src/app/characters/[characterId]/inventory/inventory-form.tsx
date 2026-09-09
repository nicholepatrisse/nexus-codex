"use client";
import Link from "next/link";
import { useActionState, useState } from "react";
import { StyledSelect } from "@/app/styled-select";
import { FormField } from "@/app/form-field";
import type { InventoryFormState } from "./actions";
import type { InventoryEntry } from "@/character/inventory";
import { ItemCatalogSearch, type ImportedItemChoice } from "@/app/characters/item-catalog-search";
import { validateInventoryEntry } from "@/character/inventory-validation";
import { materialTitleWithoutCitation, normalizeMaterialIdentity } from "@/materials/material-identity";
import { MaterialResolutionActions } from "@/materials/material-resolution-actions";

type ChronicleOption = { id: string; scenarioNumberSnapshot: string; scenarioNameSnapshot: string };
const initial: InventoryFormState = {};
function ErrorText({ errors }: { errors?: string[] }) { return errors?.length ? <p className="mt-1 text-sm text-danger">{errors[0]}</p> : null; }
export function InventoryForm({ characterId, entry, chronicles, ownedMaterialIdentities, idempotencyKey, action }: { characterId: string; entry?: InventoryEntry; chronicles: ChronicleOption[]; ownedMaterialIdentities: string[]; idempotencyKey?: string; action: (state: InventoryFormState, data: FormData) => Promise<InventoryFormState> }) {
  const [state, formAction, pending] = useActionState(action, initial);
  const [acquisitionType, setAcquisitionType] = useState(entry?.acquisitionType ?? "purchased");
  const [itemName, setItemName] = useState(entry?.itemNameSnapshot ?? "");
  const [contentItemId, setContentItemId] = useState(entry?.contentItemId ?? "");
  const [itemLink, setItemLink] = useState(entry?.itemLinkSnapshot ?? "");
  const [notes, setNotes] = useState(entry?.notes ?? "");
  const [validationNote, setValidationNote] = useState(entry?.validationNote ?? "");
  const [sourceMaterialTitle, setSourceMaterialTitle] = useState(entry?.sourceMaterialTitle ?? "");
  const [sourceMaterialIdentity, setSourceMaterialIdentity] = useState(entry?.sourceMaterialIdentity ?? "");
  const [sourceMaterialId, setSourceMaterialId] = useState(entry?.sourceMaterialId ?? "");
  const [addedMaterialIdentities, setAddedMaterialIdentities] = useState<string[]>([]);
  const [societyLegal, setSocietyLegal] = useState(entry?.societyLegal == null ? "" : String(entry.societyLegal));
  const [societyStatus, setSocietyStatus] = useState(entry?.societyStatus ?? "");
  const [rarity, setRarity] = useState(entry?.rarity ?? "");
  const [sourceChronicleId, setSourceChronicleId] = useState(entry?.sourceChronicleId ?? "");
  const [bulk, setBulk] = useState(entry?.bulkSnapshot ?? "");
  const [quantity, setQuantity] = useState(String(entry?.quantity ?? 1));
  const [unitPrice, setUnitPrice] = useState("");
  const [totalPrice, setTotalPrice] = useState("");
  const [itemValue, setItemValue] = useState(String(entry?.valueMinor ?? ""));
  const [amountPaid, setAmountPaid] = useState(String(entry?.amountPaidMinor ?? ""));
  const [amountPaidAdjusted, setAmountPaidAdjusted] = useState(Boolean(entry));
  const [lookupMessage, setLookupMessage] = useState<string>();
  function defaultAmountPaid(value = itemValue, count = quantity, acquisition = acquisitionType) {
    return acquisition === "starting_equipment" || !value ? "" : String(Number(value) * (Number(count) || 1));
  }
  function applyImport(choice: ImportedItemChoice) {
    const { item, notes: importedNotes } = choice;
    setItemName(item.name); setContentItemId(""); setItemLink(item.url); setNotes(importedNotes); setBulk(item.bulk ?? ""); setSourceMaterialTitle(item.source ?? ""); setSourceMaterialId(choice.sourceMaterialId ?? ""); setSourceMaterialIdentity(choice.sourceMaterialIdentity ?? (item.source ? normalizeMaterialIdentity(materialTitleWithoutCitation(item.source)) : "")); setSocietyLegal(item.societyLegal == null ? "" : String(item.societyLegal)); setSocietyStatus(item.societyStatus ?? ""); setRarity(item.rarity ?? "");
    if (item.priceCredits != null) { const price = String(item.priceCredits); const total = String(item.priceCredits * (Number(quantity) || 1)); setItemValue(price); setUnitPrice(price); setTotalPrice(total); if (!amountPaidAdjusted) setAmountPaid(defaultAmountPaid(price)); }
    setLookupMessage(`${item.name} imported. Review and edit the details before saving.`);
  }
  const field = "mt-1 min-h-12 w-full rounded-xl border border-border-strong bg-surface px-4 py-2.5";
  const acquisitionOptions = [{ value: "starting_equipment", label: "Starting equipment" }, { value: "purchased", label: "Purchased" }, { value: "crafted", label: "Crafted" }, { value: "boon_reward", label: "Boon reward" }, { value: "other", label: "Other" }];
  const chronicleOptions = [{ value: "", label: "No Chronicle" }, ...chronicles.map((chronicle) => ({ value: chronicle.id, label: `${chronicle.scenarioNumberSnapshot} — ${chronicle.scenarioNameSnapshot}` }))];
  const validation = validateInventoryEntry({ itemNameSnapshot: itemName || "This item", itemLinkSnapshot: itemLink || null, sourceMaterialIdentity: sourceMaterialIdentity || null, sourceMaterialTitle: sourceMaterialTitle || null, societyLegal: societyLegal === "true" ? true : societyLegal === "false" ? false : null, societyStatus: societyStatus || null, rarity: rarity || null, sourceChronicleId: sourceChronicleId || null }, [...ownedMaterialIdentities, ...addedMaterialIdentities]);
  const missingMaterial = validation.issues.some((issue) => issue.type === "missing_material_ownership" && issue.resolvable);
  return <form action={formAction} className="mt-8 space-y-5">
    <input type="hidden" name="contentItemId" value={contentItemId} />
    <input type="hidden" name="sourceMaterialIdentity" value={sourceMaterialIdentity} />
    <input type="hidden" name="sourceMaterialId" value={sourceMaterialId} />
    <input type="hidden" name="societyLegal" value={societyLegal} />
    <input type="hidden" name="societyStatus" value={societyStatus} />
    <input type="hidden" name="rarity" value={rarity} />
    {idempotencyKey ? <input type="hidden" name="idempotencyKey" value={idempotencyKey} /> : null}
    <ItemCatalogSearch initialQuery={itemName} onSelected={applyImport} />
    <FormField id="itemName" label="Item name" errors={state.fieldErrors?.itemName}>{(controlProps) => <input {...controlProps} className={field.replace("mt-1 ", "")} name="itemName" required maxLength={200} value={itemName} onChange={(event) => { setItemName(event.target.value); setContentItemId(""); }} />}</FormField>
    <div><label className="text-sm font-semibold" htmlFor="itemLink">Item link <span className="font-normal text-text-muted">(optional)</span></label><input className={field} id="itemLink" name="itemLink" type="url" inputMode="url" maxLength={2000} placeholder="https://2e.aonsrd.com/treasure/…" value={itemLink} onChange={(event) => setItemLink(event.target.value)} /><p className="mt-1 text-sm text-text-muted">Populated by item search or editable for manual entries.</p><ErrorText errors={state.fieldErrors?.itemLink} />{lookupMessage ? <p role="status" className="mt-1 text-sm text-success">{lookupMessage}</p> : null}</div>
    <div className="grid gap-5 sm:grid-cols-3"><div><label className="text-sm font-semibold" htmlFor="quantity">Quantity</label><input className={field} id="quantity" name="quantity" type="number" min="1" step="1" required value={quantity} onChange={(event) => { const next = event.target.value; setQuantity(next); if (!amountPaidAdjusted) setAmountPaid(defaultAmountPaid(itemValue, next)); if (unitPrice) setTotalPrice(String(Number(unitPrice) * (Number(next) || 1))); }} /><ErrorText errors={state.fieldErrors?.quantity} /></div><div><label className="text-sm font-semibold" htmlFor="bulk">Bulk <span className="font-normal text-text-muted">(each)</span></label><input className={field} id="bulk" name="bulk" maxLength={20} placeholder="—, L, 1…" value={bulk} onChange={(event) => setBulk(event.target.value)} /><ErrorText errors={state.fieldErrors?.bulk} /></div><div><label className="text-sm font-semibold" htmlFor="acquisitionType">Acquisition</label><StyledSelect name="acquisitionType" label="Acquisition" defaultValue={entry?.acquisitionType ?? "purchased"} options={acquisitionOptions} invalid={Boolean(state.fieldErrors?.acquisitionType)} onValueChange={(next) => { setAcquisitionType(next); if (!amountPaidAdjusted) setAmountPaid(defaultAmountPaid(itemValue, quantity, next)); }} /></div></div>
    <div><label className="text-sm font-semibold" htmlFor="acquiredOn">Acquired on</label><input className={field} id="acquiredOn" name="acquiredOn" type="date" required defaultValue={entry?.acquiredOn ?? new Date().toISOString().slice(0,10)} /><ErrorText errors={state.fieldErrors?.acquiredOn} /></div>
    <div className="space-y-5"><div><label className="text-sm font-semibold" htmlFor="valueMinor">Item value <span className="font-normal text-text-muted">(credits each)</span></label><input className={field} id="valueMinor" name="valueMinor" type="number" min="0" step="1" value={itemValue} onChange={(event) => { const next = event.target.value; setItemValue(next); if (!amountPaidAdjusted) setAmountPaid(defaultAmountPaid(next)); if (!entry && acquisitionType === "purchased") { setUnitPrice(next); setTotalPrice(String(Number(next) * (Number(quantity) || 1))); } }} /><p className="mt-1 text-sm text-text-muted">Used to calculate sale proceeds, including for starting equipment and rewards.</p><ErrorText errors={state.fieldErrors?.valueMinor} /></div>
    <details className="rounded-2xl border border-border bg-surface-raised p-4"><summary className="cursor-pointer text-sm font-semibold">Acquisition cost <span className="font-normal text-text-muted">(optional adjustment)</span></summary><div className="mt-4">{!entry && acquisitionType === "purchased" ? <><div className="grid gap-5 sm:grid-cols-2"><div><label className="text-sm font-semibold" htmlFor="unitPriceMinor">Unit price <span className="font-normal text-text-muted">(credits)</span></label><input className={field} id="unitPriceMinor" name="unitPriceMinor" type="number" min="1" step="1" required value={unitPrice} onChange={(event) => { setUnitPrice(event.target.value); setAmountPaidAdjusted(true); }} /><ErrorText errors={state.fieldErrors?.unitPriceMinor} /></div><div><label className="text-sm font-semibold" htmlFor="totalPriceMinor">Total paid <span className="font-normal text-text-muted">(credits)</span></label><input className={field} id="totalPriceMinor" name="totalPriceMinor" type="number" min="1" step="1" required value={totalPrice} onChange={(event) => { setTotalPrice(event.target.value); setAmountPaidAdjusted(true); }} /><ErrorText errors={state.fieldErrors?.totalPriceMinor} /></div></div><p className="mt-2 text-sm text-text-muted">Defaults to item value × quantity. Adjust it if the character paid a different price; saving debits this total.</p></> : <div><label className="text-sm font-semibold" htmlFor="amountPaidMinor">Amount paid <span className="font-normal text-text-muted">(total credits)</span></label><input className={field} id="amountPaidMinor" name="amountPaidMinor" type="number" min="0" step="1" value={amountPaid} onChange={(event) => { setAmountPaid(event.target.value); setAmountPaidAdjusted(true); }} /><p className="mt-1 text-sm text-text-muted">Defaults to total item value. Starting equipment defaults to blank.</p><ErrorText errors={state.fieldErrors?.amountPaidMinor} /></div>}</div></details></div>
    <div><label className="text-sm font-semibold" htmlFor="sourceChronicleId">Source Chronicle <span className="font-normal text-text-muted">(optional)</span></label><StyledSelect name="sourceChronicleId" label="Source Chronicle" value={sourceChronicleId} onValueChange={setSourceChronicleId} options={chronicleOptions} invalid={Boolean(state.fieldErrors?.sourceChronicleId)} /><ErrorText errors={state.fieldErrors?.sourceChronicleId} /></div>
    <div><FormField id="sourceMaterialTitle" label="Rules source" optional errors={state.fieldErrors?.sourceMaterialTitle}>{(controlProps) => <input {...controlProps} className={field.replace("mt-1 ", "")} name="sourceMaterialTitle" maxLength={300} placeholder="Starfinder Player Core" value={sourceMaterialTitle} onChange={(event) => { setSourceMaterialTitle(event.target.value); setSourceMaterialIdentity(""); }} />}</FormField>{missingMaterial && sourceMaterialIdentity && sourceMaterialTitle ? <div className="mt-2 rounded-xl border border-border-strong bg-surface p-3 text-sm text-text-muted" aria-live="polite"><p>{validation.issues.find((issue) => issue.type === "missing_material_ownership")?.message}</p><MaterialResolutionActions title={sourceMaterialTitle} identity={sourceMaterialIdentity} onAdded={(identities) => setAddedMaterialIdentities((current) => [...new Set([...current, ...identities])])} onAddNote={() => document.getElementById("validationNote")?.focus()} /></div> : validation.status === "validated" && sourceMaterialTitle ? <p role="status" className="mt-2 text-sm text-success">Validated</p> : null}</div>
    <FormField id="validationNote" label="Validation note" optional errors={state.fieldErrors?.validationNote}>{(controlProps) => <textarea {...controlProps} className={field.replace("mt-1 ", "")} name="validationNote" rows={3} maxLength={1000} value={validationNote} onChange={(event) => setValidationNote(event.target.value)} />}</FormField>
    <FormField id="notes" label="Notes" optional errors={state.fieldErrors?.notes}>{(controlProps) => <textarea {...controlProps} className={field.replace("mt-1 ", "")} name="notes" rows={8} maxLength={5000} value={notes} onChange={(event) => setNotes(event.target.value)} />}</FormField>
    {state.formError ? <p className="rounded-xl border border-danger/40 bg-danger/10 p-3 text-sm text-danger">{state.formError}</p> : null}
    <div className="flex gap-3"><button disabled={pending} className="rounded-full bg-brand px-5 py-2.5 font-semibold text-white disabled:opacity-60">{pending ? "Saving…" : "Save inventory entry"}</button><Link className="rounded-full border border-border-strong px-5 py-2.5 font-semibold" href={`/characters/${characterId}?tab=inventory`}>Cancel</Link></div>
  </form>;
}
