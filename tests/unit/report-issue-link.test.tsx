import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ApplicationFooter } from "@/app/application-footer";
import { REPORT_ISSUE_URL } from "@/app/external-links";

describe("report issue action", () => {
  it("renders a persistent, accessible external link in the application footer", () => {
    const markup = renderToStaticMarkup(<ApplicationFooter />);

    expect(markup).toContain("Report an issue");
    expect(markup).toContain(`href="${REPORT_ISSUE_URL}"`);
    expect(markup).toContain('target="_blank"');
    expect(markup).toContain('rel="noopener noreferrer"');
    expect(markup).toContain('aria-hidden="true"');
  });
});
