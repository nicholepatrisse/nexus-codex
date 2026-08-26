import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

const css = readFileSync(fileURLToPath(new URL("../../src/app/globals.css", import.meta.url)), "utf8");

function themeCss(mode: "dark" | "light") {
  if (mode === "dark") return css.slice(css.indexOf(":root"), css.indexOf("@media (prefers-color-scheme: light)"));
  const media = css.slice(css.indexOf("@media (prefers-color-scheme: light)"));
  return media.slice(media.indexOf(":root"), media.indexOf("@theme inline"));
}

function themeColor(mode: "dark" | "light", name: string) {
  const match = themeCss(mode).match(new RegExp(`--theme-${name}:\\s*(#[0-9a-f]{6})`, "i"));
  if (!match) throw new Error(`Missing theme color: ${name}`);
  return match[1]!;
}

function luminance(hex: string) {
  const channels = hex.match(/[0-9a-f]{2}/gi)?.map((value) => Number.parseInt(value, 16) / 255);
  if (!channels || channels.length !== 3) throw new Error(`Invalid color: ${hex}`);
  const [red, green, blue] = channels.map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4) as [number, number, number];
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function contrast(first: string, second: string) {
  const [lighter, darker] = [luminance(first), luminance(second)].sort((a, b) => b - a) as [number, number];
  return (lighter + 0.05) / (darker + 0.05);
}

describe("theme accessibility contract", () => {
  const textSurfaces = ["background", "surface", "surface-raised"];

  test.each(["dark", "light"] as const)("%s theme meets WCAG AA for normal text", (mode) => {
    for (const foreground of ["text-primary", "text-muted", "text-subtle", "brand", "success", "warning", "danger", "info"]) {
      for (const background of textSurfaces) {
        expect(contrast(themeColor(mode, foreground), themeColor(mode, background)), `${mode}: ${foreground} on ${background}`).toBeGreaterThanOrEqual(4.5);
      }
    }
    expect(contrast(themeColor(mode, "on-brand"), themeColor(mode, "brand")), `${mode}: button text`).toBeGreaterThanOrEqual(4.5);
  });

  test.each(["dark", "light"] as const)("%s strong borders remain visible against control surfaces", (mode) => {
    expect(contrast(themeColor(mode, "border-strong"), themeColor(mode, "surface-raised"))).toBeGreaterThanOrEqual(3);
  });

  test("tracks the system color scheme without JavaScript", () => {
    expect(css).toContain("@media (prefers-color-scheme: light)");
    expect(themeCss("dark")).toContain("color-scheme: dark");
    expect(themeCss("light")).toContain("color-scheme: light");
  });

  test("the global stylesheet preserves non-color interaction cues", () => {
    expect(css).toMatch(/:focus-visible\s*\{[^}]*outline:\s*3px solid/i);
    expect(css).toMatch(/:disabled\s*\{[^}]*filter:/i);
    expect(css).toMatch(/\[aria-invalid="true"\]\s*\{[^}]*box-shadow:/i);
    expect(css).toMatch(/\[aria-current="page"\][^{]*\{[^}]*box-shadow:/i);
  });
});
