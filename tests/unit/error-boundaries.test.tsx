import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { getOpaqueErrorId } from "@/app/error-identity";
import { ErrorState } from "@/app/error-state";
import RouteError from "@/app/error";
import GlobalError from "@/app/global-error";
import { REPORT_ISSUE_URL } from "@/app/external-links";

describe("application error boundaries", () => {
  it("renders safe route recovery actions and an opaque reference", () => {
    const markup = renderToStaticMarkup(
      <RouteError
        error={Object.assign(new Error("database password must stay private"), { digest: "123456" })}
        reset={() => undefined}
      />,
    );

    expect(markup).toContain("Something went wrong");
    expect(markup).toContain("Try again");
    expect(markup).toContain('href="/"');
    expect(markup).toContain(`href="${REPORT_ISSUE_URL}"`);
    expect(markup).toContain('target="_blank"');
    expect(markup).toContain('rel="noopener noreferrer"');
    expect(markup).toContain("Report an issue");
    expect(markup).toContain("NC-123456");
    expect(markup).not.toContain("stack");
    expect(markup).not.toContain("database");
    expect(markup).not.toContain("password");
  });

  it("renders the root-layout fallback and invokes its recovery action", () => {
    const reset = vi.fn();
    const state = ErrorState({ errorId: "NC-root", onRetry: reset, global: true });
    const section = state.props.children;
    const actions = section.props.children.at(-1);
    const retryButton = actions.props.children[0];

    retryButton.props.onClick();

    expect(reset).toHaveBeenCalledOnce();
    const markup = renderToStaticMarkup(
      <GlobalError
        error={Object.assign(new Error("provider response"), { digest: "root" })}
        reset={reset}
      />,
    );
    expect(markup).toContain("Nexus Codex couldn’t start");
    expect(markup).toContain("NC-root");
    expect(markup).not.toContain("provider response");
  });

  it("uses a framework digest only when it is safe and opaque", () => {
    expect(getOpaqueErrorId(Object.assign(new Error("private details"), { digest: "9384756" })))
      .toBe("NC-9384756");
    expect(getOpaqueErrorId(Object.assign(new Error("private details"), { digest: "secret value" })))
      .toMatch(/^NC-[a-z0-9-]+$/i);
  });
});
