import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { allowsDialogClose, Dialog } from "@/app/dialog";

describe("shared dialog", () => {
  it("gives the dialog an accessible name, description, and close control", () => {
    const html = renderToStaticMarkup(<Dialog open title="Add scenario" description="Paste a URL." onClose={() => {}}><label>Scenario URL<input /></label></Dialog>);

    expect(html).toContain("<dialog");
    expect(html).toMatch(/aria-labelledby="([^"]+)"/);
    expect(html).toMatch(/aria-describedby="([^"]+)"/);
    const titleId = html.match(/aria-labelledby="([^"]+)"/)?.[1];
    const descriptionId = html.match(/aria-describedby="([^"]+)"/)?.[1];
    expect(html).toContain(`id="${titleId}"`);
    expect(html).toContain(`id="${descriptionId}"`);
    expect(html).toContain('aria-label="Close dialog"');
  });

  it("makes Escape and backdrop dismissal explicit", () => {
    expect(allowsDialogClose("none", "escape")).toBe(false);
    expect(allowsDialogClose("none", "backdrop")).toBe(false);
    expect(allowsDialogClose("escape", "escape")).toBe(true);
    expect(allowsDialogClose("escape", "backdrop")).toBe(false);
    expect(allowsDialogClose("backdrop", "escape")).toBe(false);
    expect(allowsDialogClose("backdrop", "backdrop")).toBe(true);
    expect(allowsDialogClose("escape-and-backdrop", "escape")).toBe(true);
    expect(allowsDialogClose("escape-and-backdrop", "backdrop")).toBe(true);
  });

  it("can omit dismissal controls for a required gate", () => {
    const html = renderToStaticMarkup(<Dialog open title="Required" onClose={() => {}} closePolicy="none" showCloseButton={false}><p>Complete this step.</p></Dialog>);
    expect(html).not.toContain("Close dialog");
  });
});
