# Reusable UI audit

This audit covers the UI in `src/app` for issue #187. A pattern was treated as reusable when it represented the same concept and its differences could be expressed without page-specific flags.

## Consolidated

| Pattern | Previous implementations | Decision |
| --- | --- | --- |
| Community summaries | Public directory, home-page active communities, archived communities | Shared `CommunityCard`; content and destination remain composable through `description`, `metadata`, `href`, and the muted variant. |
| Empty states | Character list, public directory, home-page communities | Shared `EmptyState`; semantic container, alignment, optional icon, action, and spacing remain configurable. |
| Compact status badges | GM credit and membership-request states | Shared `StatusBadge` owns tone-safe light/dark colors and pill sizing; `GmCreditBadge` remains a domain wrapper for its accessibility label. |

Existing shared `GameCard`, `SelectionCard`, `TabRow`, and `SessionStatusPill` are already used across their applicable flows and should remain the preferred implementations.

## Follow-up candidates

- Chronicle cards: unapplied chronicles and character-history chronicles share scenario, GM-credit, status, and play metadata. Their actions and applied/pending semantics need a small domain model before consolidation.
- Character summaries: the character index, roster assignment, and selectors show the same identity and progression data. Consolidate after deciding whether the class icon is part of the shared identity treatment.
- Form field shells: labels, help text, errors, and control spacing repeat across session, character, inventory, and community forms. Extract a small field wrapper before standardizing individual controls.
- Modal layouts: society-number gating and scenario catalog entry share modal structure, but focus trapping and dismissal behavior should be solved as part of an accessible dialog primitive.
- Metadata/detail rows: chronicle, roster, scenario preview, and inventory views repeat term/value layouts. A semantic `DescriptionList` composition could reduce styling drift.

## Intentionally separate

- Inventory cards and selection cards may look similar, but inventory cards own sale actions and purchase state while selection cards are native radio controls.
- Admission request cards and community cards link to the same domain but represent workflow state rather than a community summary.
- Session detail panels and reporting summaries have different interaction and authorization responsibilities; sharing their outer border alone would not justify an abstraction.
