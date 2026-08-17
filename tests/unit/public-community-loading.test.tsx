import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import CommunitiesLoading from "@/app/communities/loading";

describe("public community directory loading state", () => {
  it("announces loading without exposing community data", () => {
    const markup = renderToStaticMarkup(<CommunitiesLoading />);

    expect(markup).toContain('aria-busy="true"');
    expect(markup).toContain('aria-label="Loading public communities"');
    expect(markup).not.toContain("private");
    expect(markup).not.toContain("archived");
  });
});
