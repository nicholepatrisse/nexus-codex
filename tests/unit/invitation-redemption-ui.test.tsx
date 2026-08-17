import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import InvitationResultPage from "@/app/invitations/result/page";

describe("invitation redemption UI", () => {
  it("uses a token-free pending result page", () => {
    const markup = renderToStaticMarkup(<InvitationResultPage />);
    expect(markup).toContain("Request received");
    expect(markup).toContain("awaiting review");
    expect(markup).not.toMatch(/token|recipient|private community/i);
  });
});
