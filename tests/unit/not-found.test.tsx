import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import NotFound from "@/app/not-found";

describe("not-found page", () => {
  it("explains the missing page and provides a homepage recovery link", () => {
    const markup = renderToStaticMarkup(<NotFound />);

    expect(markup).toContain("Error 404");
    expect(markup).toContain("Page not found");
    expect(markup).toContain("The page you requested doesn’t exist or may have moved.");
    expect(markup).toContain('href="/"');
    expect(markup).toContain("Return home");
    expect(markup).toContain('aria-labelledby="not-found-title"');
    expect(markup).toContain("accent-brand-gradient");
  });
});
