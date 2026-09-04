import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ApplicationFooter } from "@/app/application-footer";
import { REPORT_ISSUE_URL } from "@/app/external-links";

describe("report issue action", () => {
  it("opens the bug report template by default", () => {
    expect(REPORT_ISSUE_URL).toBe(
      "https://github.com/nicholepatrisse/nexus-codex/issues/new?template=02-bug.md",
    );
  });

  it("renders a persistent, accessible external link in the application footer", () => {
    const markup = renderToStaticMarkup(<ApplicationFooter />);

    expect(markup).toContain("Report an issue");
    expect(markup).toContain(`href="${REPORT_ISSUE_URL}"`);
    expect(markup).toContain('target="_blank"');
    expect(markup).toContain('rel="noopener noreferrer"');
    expect(markup).toContain('aria-hidden="true"');
  });
});
