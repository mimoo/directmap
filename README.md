# Wayfinder

A mobile-first web game that teaches map reading and direction following — as
one infinite puzzle run. You're the town courier: every parcel is a small
navigation puzzle, three wrong deliveries end the run, and your best run is
the score. New challenge types and nastier maps appear the further you get.

Each challenge type targets one specific way people get lost:

| Challenge | Trains | Failure mode |
| --- | --- | --- |
| Body Compass | tap the cell on your LEFT/RIGHT/AHEAD/BEHIND | egocentric directions under rotation ("left" ≠ screen-left) |
| Compass Steps | walk one block NORTH with turn/walk controls | cardinal ↔ relative conversion |
| The Delivery Note | follow a multi-step note | heading tracking across turns (dead reckoning) |
| Lost & Found | match a street view to a spot on the map | self-localization from a first-person view |
| Postcards | predict which view a map pose sees | map pose → expected view |
| The Real World | real Street View photo vs. real map | relating a photo to a north-up map (optional) |

Difficulty is a *level* that adapts to you (`Run.tsx`), not the raw parcel
count: nail a few in a row and it climbs faster and faster (+1 up to +4 a
delivery); miss and it drops back two, easing the next few parcels. The
schedule (`SCHEDULE` in `src/engine/questions.ts`) unlocks challenges by level
and retires ones that got too easy. Around level ~20 the map starts arriving
rotated ("up" is no longer north — the alignment effect); by ~37 the courier
turns invisible while walking — so a sharp player reaches the nasty maps in a
handful of parcels, while a struggling one gets more room to learn.

## How it works

Everything renders from one data model (`src/engine/town.ts`): an odd-sized
grid where odd/odd cells are intersections, even/even cells are blocks holding
landmarks/houses/parks. The top-down map (`MapView`) and the first-person
street view (`StreetView`) are both derived from it, so views and map can
never disagree — and puzzle generators verify via *salient* scene signatures
(the near facades and road you actually read at a glance, not a tiny building
five blocks off) that every multiple-choice puzzle has exactly one answer that
looks right.

Wrong answers teach: the map animates to the character's frame (watch your
"left" become screen-left), routes replay as dotted trails, and wrong
"where am I" picks show what that spot would actually see. The first time a
challenge type appears, its one-paragraph lesson is shown.

## Real-world postcards (optional)

With a Google Maps API key (Street View Static API + Maps Static API
enabled), every 6th parcel becomes a real photo from a real city next to a
north-up map: work out which way the camera looks. The answer is correct by
construction — the photo is requested with an explicit `heading` parameter.
The key is entered on the home screen, stored only in localStorage, and
requests go directly from the browser to Google. If a photo fails to load
(no key quota, no coverage), the round skips gracefully with no heart lost.

## Stack

Vite + React + TypeScript, SVG rendering (no game engine), Zustand with
localStorage persistence, Fontsource-bundled fonts (Fraunces + Nunito),
Vitest for the engine.

## Develop

```sh
npm install
npm run dev        # dev server
npx vitest run     # engine tests (dir math, town gen, puzzle validity, schedule)
npm run build      # production build to dist/
```
