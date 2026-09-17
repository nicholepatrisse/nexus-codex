import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ pathname: "/characters" }));

vi.mock("next/navigation", () => ({
  usePathname: () => mocks.pathname,
  useRouter: () => ({ refresh: vi.fn(), replace: vi.fn() }),
}));
vi.mock("@/auth/client", () => ({
  authClient: { useSession: () => ({ data: { user: { id: "person-1" } }, isPending: false }), signOut: vi.fn() },
}));
vi.mock("@/app/notification-actions", () => ({
  clearNotificationsAction: vi.fn(),
  markNotificationsReadAction: vi.fn(),
}));

import { ApplicationHeader } from "@/app/application-header";

describe("application header", () => {
  beforeEach(() => { mocks.pathname = "/characters"; });

  it("uses the full wordmark and exposes the mobile navigation", () => {
    const markup = renderToStaticMarkup(<ApplicationHeader notifications={[]} displayName="Nova Pilot" initiallySignedIn />);

    expect(markup).toContain('aria-label="Nexus Codex home"');
    expect(markup).toContain("%2Fnexus-codex-wordmark.png");
    expect(markup).not.toContain("nexus-codex-mark.svg");
    expect(markup).toContain('aria-label="Mobile primary"');
    expect(markup).toContain('href="/games/browse"');
    expect(markup).toContain("Discover");
    expect(markup).toContain("Characters");
    expect(markup).toContain('aria-controls="account-menu"');
    expect(markup).toContain('href="/profile"');
    expect(markup).toContain('href="/profile?tab=notifications"');
    expect(markup).toContain('href="/profile?tab=materials"');
    expect(markup).toContain("application-account-signout");
    expect(markup).toContain("Hello,");
    expect(markup).toContain("Nova Pilot");
    expect(markup).toContain("application-nav-icon");
    expect(markup).toContain("application-nav-link-active");
    expect(markup).toContain("application-mobile-nav-link-active");
  });

  it("marks the matching desktop and mobile destinations current", () => {
    mocks.pathname = "/communities/nexus-lodge";
    const markup = renderToStaticMarkup(<ApplicationHeader notifications={[]} displayName="Nova Pilot" initiallySignedIn />);

    expect(markup.match(/aria-current="page"[^>]*href="\/communities"/g)).toHaveLength(2);
  });

  it("uses the visual-system notification controls", () => {
    const markup = renderToStaticMarkup(<ApplicationHeader notifications={[{ id: "notice-1", actionable: true, isRead: false, kind: "applicant.membership.status", title: "Incoming table", message: "Your seat is ready.", href: "/communities/nexus", occurredAt: new Date(0) }]} displayName="Nova Pilot" initiallySignedIn />);

    expect(markup).toContain("application-notification-button");
    expect(markup).toContain("application-notification-indicator");
  });
});
