# Light and dark theme accessibility review

Reviewed against WCAG 2.2 AA. The semantic palette is enforced by
`tests/unit/theme-accessibility.test.ts` for both system color schemes so later theme changes cannot silently
reduce normal-text contrast below 4.5:1 or strong control borders below 3:1.

## Review result

- Primary, muted, subtle, link, and status text meet 4.5:1 on the background,
  surface, and raised-surface tokens.
- Brand-filled buttons use a dedicated semantic foreground token and retain at
  least 4.5:1 contrast in both themes.
- Strong borders meet 3:1 against raised control surfaces; ordinary structural
  borders were also increased for visibility.
- All links, buttons, form controls, menu items, and tabs receive a three-pixel
  keyboard focus outline with offset, including components without local focus
  utilities.
- Invalid controls use a border plus an additional ring and are paired with
  textual errors in the forms. Current-page and selected-tab states use an
  inset indicator in addition to color. Status badges and messages contain
  explicit text rather than communicating meaning through hue or glow alone.
- Disabled controls use text, cursor, opacity, and reduced saturation cues.
- Hover styling is supplementary; names, labels, underlines, borders, and focus
  indicators preserve meaning without hover or glow.

The automated contract covers palette regressions. Component tests continue to
cover the visible status and error wording used by individual workflows.

## Shared presentation primitives

`src/app/visual-system.tsx` provides the layout-neutral pieces for redesign work:

- `AngularPanel` frames major grouped content; callers continue to own padding.
- `SectionEyebrow` labels a section above its heading without replacing that heading.
- `ActionButton` supplies primary and secondary link/button states.
- `CoverFrame` reserves portrait or square media geometry without modifying artwork.
- `PageHero` provides one page-level heading and optional eyebrow; `StarfieldMotif`
  is ambient only and is always hidden from assistive technology.

All colors come from semantic tokens. Motion is removed under
`prefers-reduced-motion`, and decorative layers ignore pointer events.
