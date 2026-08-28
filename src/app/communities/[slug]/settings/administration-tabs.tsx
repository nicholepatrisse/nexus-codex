"use client";

import { useState, type ReactNode } from "react";
import { TabRow, tabClassName } from "@/app/tab-row";

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
    <TabRow tabListLabel="Community administration">
      {tabs.map((tab) => {
        const selected = tab.id === active?.id;
        return <button key={tab.id} id={`tab-${tab.id}`} type="button" role="tab" aria-selected={selected} aria-controls={`panel-${tab.id}`} onClick={() => setActiveId(tab.id)} className={tabClassName(selected)}>{tab.label}{tab.badge ? <span className={`rounded-full px-2 py-0.5 text-xs ${selected ? "bg-brand/10 text-brand" : "bg-surface-raised text-text-muted"}`}>{tab.badge}</span> : null}</button>;
      })}
    </TabRow>
    {active ? <div id={`panel-${active.id}`} role="tabpanel" aria-labelledby={`tab-${active.id}`}>{active.content}</div> : null}
  </div>;
}
