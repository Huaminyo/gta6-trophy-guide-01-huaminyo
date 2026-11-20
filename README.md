[![make.fun · gta6-trophy-guide-01](https://make.fun/badge/gta6-trophy-guide-01.svg)](https://make.fun/bounty/gta6-trophy-guide-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-trophy-guide-01)
[![rank](https://make.fun/badge/gta6-trophy-guide-01/Huaminyo/gta6-trophy-guide-01-huaminyo/rank.svg)](https://make.fun/bounty/gta6-trophy-guide-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-trophy-guide-01)
[![reward](https://make.fun/badge/gta6-trophy-guide-01/Huaminyo/gta6-trophy-guide-01-huaminyo/reward.svg)](https://make.fun/bounty/gta6-trophy-guide-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-trophy-guide-01)

# The Leonida Field Manual — GTA VI Trophy Guide & Tracker

An offline web app that guides and tracks all 55 PlayStation 5 trophies of
Grand Theft Auto VI. Built for the make.fun bounty `gta6-trophy-guide-01`.

## What is inside

- **Tracker** — all 55 trophies with official names, descriptions and grades,
  in roadmap order, in a three-column dashboard: checklist on the left, the
  selected trophy's full guide in the middle, Next Up and sources on the
  right. Progress is saved in the browser (localStorage) and can be exported
  to a file and imported back. Filters by kind and grade, text search, and a
  hide-earned toggle. A spoiler shield hides story trophies until earned.
- **Guide** — every trophy has a guide in our own words, written for this
  entry, as numbered steps with inline citations: 160 steps, 160 cited,
  32 backed by two or more sources. Each guide names its sources beside it.
- **Routes** — the big count trophies (250 stunts, 42 shooting gold medals,
  18 meditations, 100 scans, and more) get an ordered stage plan whose counts
  add up to the trophy target.
- **Roadmap** — four phases to the platinum (~200 hours), each with its
  trophies, hours, and a progress bar.
- **Missables & Risks** — the one possibly missable trophy (Positive Mental
  Attitude, Chapter 1 balcony meditation) with its full method and dispute,
  plus a risk register: 1 possibly missable, 5 watch, 3 unconfirmed.
- **Sources & Disputes** — 15 sources, read 20 Nov 2026, with a cited-by
  matrix; 9 disagreements between sources, shown both ways with our call.
- **Count trackers** — 29 trophies with a target get a saved counter.
- **100% Checklist** — the completion totals the game tracks, plus every
  trophy in one checklist.

## Audit strip

The strip under the masthead is computed from the data on every load, so the
numbers on screen are always the numbers in the files: 55/55 official,
160/160 steps cited, 32 with 2+ sources, 15 sources, 9 disputes,
29 count trackers, 1 possibly missable, 5 watch, 3 unconfirmed.

## Run it

```sh
cd app && python3 -m http.server 8080   # then open http://localhost:8080
```

Or serve `app/` with any static file server. The app fetches only its own
files and works with the network off; source links open only when followed.
Add `?demo=1` to the URL to see the tracker seeded with a mid-run state.

## Hand it in

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

`main.ts` copies `app/` and `screenshots/` to the output directory and writes
`dossier.json` with the kit's `buildDossier` library.

## License

MIT. Unofficial fan guide: no Rockstar Games logo, artwork or game
screenshots are used. Trophy names and descriptions are PlayStation's
official text; all guide text is original to this entry.
