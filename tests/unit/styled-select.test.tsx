import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { StyledSelect } from "@/app/styled-select";

const options = [
  { value: "", label: "Choose one", disabled: true },
  { value: "standard", label: "Standard" },
  { value: "slow", label: "A deliberately long option label that must remain usable on small screens" },
] as const;

describe("StyledSelect", () => {
  it("represents submission and state variants", () => {
    const markup = renderToStaticMarkup(<StyledSelect name="speed" label="Speed" value="" options={options} required invalid onValueChange={() => {}} />);

    expect(markup).toContain('type="hidden" name="speed" value=""');
    expect(markup).toContain('role="combobox"');
    expect(markup).toContain('aria-required="true"');
    expect(markup).toContain('aria-invalid="true"');
    expect(markup).toContain("Choose one");
    expect(markup).not.toContain("<select");
  });

  it("disables both the submitted field and combobox", () => {
    const markup = renderToStaticMarkup(<StyledSelect name="speed" label="Speed" defaultValue="standard" options={options} disabled />);

    expect(markup).toContain('<input type="hidden" disabled="" name="speed" value="standard"');
    expect(markup).toContain('role="combobox"');
    expect(markup).toContain('disabled=""');
  });

  it("implements arrow-key, Escape, pointer, and outside-click behavior", () => {
    const source = readFileSync(new URL("../../src/app/styled-select.tsx", import.meta.url), "utf8");

    expect(source).toContain('event.key === "ArrowDown"');
    expect(source).toContain('event.key === "ArrowUp"');
    expect(source).toContain('event.key === "Escape"');
    expect(source).toContain('document.addEventListener("pointerdown"');
    expect(source).toContain("onClick={() => choose(option.value)}");
  });

  it("keeps selected character text legible and the checkmark at the row edge", () => {
    const source = readFileSync(new URL("../../src/app/styled-select.tsx", import.meta.url), "utf8");

    expect(source).toContain('selected ? "[&_.text-text-muted]:text-on-brand/80 [&_.text-text-primary]:text-on-brand"');
    expect(source).toContain('option.character) return <span className={`min-w-0 flex-1');
  });

  it("offers compact spacing for dense forms", () => {
    const markup = renderToStaticMarkup(<StyledSelect compact name="speed" label="Speed" defaultValue="standard" options={options} />);

    expect(markup).toContain('class="relative mt-1"');
    expect(markup).toContain("min-h-0 rounded-lg px-3 py-2 text-sm font-normal");
  });
});
