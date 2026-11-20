# The Leonida Field Manual — GTA VI Trophy Guide & Tracker

An offline web app that guides and tracks all 55 PlayStation 5 trophies of
Grand Theft Auto VI. Built for the make.fun bounty `gta6-trophy-guide-01`.

## What it is

- **Tracker** — a checklist of all 55 trophies with official names,
  descriptions and grades; progress saved in the browser (localStorage),
  exportable to a file and importable back. Filters by kind (story, side
  quest, collectible, activity, crime, feat, completion, platinum) and grade,
  plus toggles for missable, watch, PSN-hidden, disputed and unconfirmed
  trophies. A spoiler shield hides the 28 PSN-hidden trophies until earned.
- **Guide** — every trophy has a guide in our own words, written for this
  entry, as numbered steps with inline citations: 160 steps, 160 cited,
  32 backed by two or more sources. Each guide names its sources beside it.
- **Roadmap** — four phases to the platinum (~200 hours): Story Run
  (60–80 h), 100% Sweep (~100 h), Strangers & Cleanup (~10 h), Platinum.
- **Missables & Risks** — the one possibly missable trophy (Positive Mental
  Attitude, Chapter 1 balcony meditation) with its full method, a risk
  register (1 possibly missable, 5 watch, 3 unconfirmed), and the disputes
  register: 9 disagreements between sources, shown both ways with our call.
- **Count trackers** — 29 trophies with a target get a saved counter
  (meditations 18, stunts 250, scans 100, vaults 5, garages 8, …).
- **100% Checklist** — the confirmed requirements for A Long Road, the gold
  100%-completion trophy.

## Run it

```sh
node --experimental-strip-types serve.ts   # serves app/ on http://localhost:8080
```

Or serve `app/` with any static file server. The app fetches nothing over the
network and works with the network off; source links open only when followed.

## Hand it in

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

`main.ts` copies `app/` and `screenshots/` to the output directory and writes
`dossier.json` with the kit's `buildDossier` library.

## Sources

15 sources, read 20 Nov 2026. PowerPyx's trophy guide & roadmap was read in
full; the rest were read as published excerpts. The trophy list itself is the
kit's official list (Exophase and PSNProfiles agree on every name, description
and grade). The full source matrix, with what each source supplied and how
many guides cite it, is in the app under Sources & Disputes.

## License

MIT. Unofficial fan guide: no Rockstar Games logo, artwork or game
screenshots are used. Trophy names and descriptions are PlayStation's
official text; all guide text is original to this entry.
