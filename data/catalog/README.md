# SFS2 catalog snapshot

`sfs2-paizo.json` contains only factual scheduling metadata from Paizo's public Starfinder Society catalog: scenario code, title, content type, supported level range, and official product URL. It intentionally excludes descriptions, prices, artwork, authorship, and customer or player information.

Refresh it with `pnpm catalog:refresh:sfs2`. The importer reads the catalog sequentially, waits between pages, validates every retained field, rejects duplicate normalized codes, and sorts records numerically. Identical source HTML produces an identical snapshot; review every generated diff before committing it.

Load or update the snapshot in PostgreSQL with `pnpm catalog:seed:sfs2`. Stable identifiers and conflict updates make the seed safe to rerun.

Source: <https://store.paizo.com/starfinder/starfinder-society/>
