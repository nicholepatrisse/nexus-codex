# Selection-flow audit

Issue #185 reviewed character creation, session creation and signup, Chronicle entry, community administration, and preference-like settings.

## Converted to shared selection cards

- Starting wealth and item choices: cards expose the choice description and item level/price while keeping selected and focus states consistent.
- Session signup character choice: cards expose character name, Society number, and level before signup or reassignment.
- Session style: the virtual/physical distinction benefits from its short explanation and is now visible without opening a menu.

All converted controls use the native radio input through `SelectionCard`, preserving form submission, arrow-key radio navigation, screen-reader semantics, focus indication, disabled treatment, and a full-card touch target.

## Intentionally retained controls

- Character starting level stays a compact segmented radio group: four numeric values are faster to compare without cards.
- Character class stays an illustrated combobox: its long option set would make a card grid unwieldy.
- Season, scenario, and GM stay searchable/compact listbox-style controls. These sets can grow substantially; season already narrows scenarios, and GM labels expose identity metadata before selection.
- Chronicle catalog scenario stays a dropdown because it is a long optional autofill shortcut. Advancement, proficiency, and downtime enums stay selects or compact radios because their values are short and familiar within a repeated data-entry workflow.
- Community admission, sharing-link limits, and lifecycle actions stay buttons/selects/confirmation fields because they are administrative actions rather than object selection.
- No notification preference choice currently has competing options with explanatory metadata; binary opt-ins should remain toggles when introduced.
