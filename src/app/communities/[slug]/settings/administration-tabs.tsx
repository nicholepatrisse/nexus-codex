"use client";

import { useState, type ReactNode } from "react";

type Tab = {
  id: string;
  label: string;
  badge?: number;
  content: ReactNode;
};

export function AdministrationTabs({ tabs }: { tabs: Tab[] }) {
  const [activeId, setActiveId] = useState(tabs[0]?.id ?? "");
  const active = tabs.find(({ id }) => id === activeId) ?? tabs[0];

  return <div className="mt-8">
    <div role="tablist" aria-label="Community administration" className="flex gap-2 overflow-x-auto border-b border-white/10 pb-3">
      {tabs.map((tab) => {
        const selected = tab.id === active?.id;
        return <button key={tab.id} id={`tab-${tab.id}`} type="button" role="tab" aria-selected={selected} aria-controls={`panel-${tab.id}`} onClick={() => setActiveId(tab.id)} className={`inline-flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${selected ? "bg-[var(--accent)] text-[#07110f]" : "border border-white/15 text-[var(--muted)] hover:border-[var(--accent)] hover:text-white"}`}>{tab.label}{tab.badge ? <span className={`rounded-full px-2 py-0.5 text-xs ${selected ? "bg-black/20" : "bg-white/10 text-white"}`}>{tab.badge}</span> : null}</button>;
      })}
    </div>
    {active ? <div id={`panel-${active.id}`} role="tabpanel" aria-labelledby={`tab-${active.id}`}>{active.content}</div> : null}
  </div>;
}
