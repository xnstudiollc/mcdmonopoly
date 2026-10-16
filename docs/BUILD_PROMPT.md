# McDMonopoly: Build Instructions (for Opus 5.5)

You are taking over a project that was scoped in a planning chat. Build it end to end. Where something is ambiguous, pick a sensible default, record it in the README under "Decisions", and keep going. Commit in logical steps.

## 1. Product

**McDMonopoly** is an unofficial fan simulator for the McDonald's Canada 2026 "Monopoly Golden Edition" promotion. The user picks a 2026 McDonald's item that carries gold Monopoly stickers and peels the stickers off with the mouse or finger. Each sticker reveals a game stamp or prize. Results are collected on the Monopoly board scan, and duplicates are discarded automatically.

## 2. Assets already in the repo (do not re-download anything)

| Path | What it is | Notes |
|---|---|---|
| `public/assets/board/monopoly-board.png` | The Monopoly board (page 2 of the supplied PDF), 2850x2850 | Contains the property spaces, the prizes-on-pack grid in the middle, the airports, highways, and the corner spaces. Map spaces by coordinates (see 6). |
| `public/assets/stickers/gold-sticker-front.png` | Gold "MONOPOLY Golden Edition" peel sticker, 563x496 RGBA | One PNG that holds **two stacked stickers** on a dark background. Crop it into a single clean sticker front with a transparent background. Check the alpha channel first and cut the sticker out if it is not transparent. Use the die-cut outline as the mask. |
| `public/assets/board/prize-cards-sheet.jpg` | 2000x2000 sheet of 24 stamp cards (#801 to #828, with some missing) | **Reference only.** The codes on it look generated and are not real, so never display or use them. Use it for the card colors and the layout of the reveal card, and for the property-to-color-group mapping. |
| `docs/prizes-and-odds.source.json` | The full prize and odds list, 89 entries | The source of truth for odds. See section 5. |
| `docs/MONOPOLY-gameboard.pdf` | The original 2-page PDF | Page 2 is the board in use. Page 1 is an alternate that is not used. |
| `public/assets/items/` | **Empty on purpose** | The user has not yet supplied the item scans. See section 4. |

## 3. Tech stack

- Vite, React and TypeScript (strict mode). Three.js for the peel. No backend.
- Vitest for the unit tests.
- Pointer events only (mouse, touch, pen). Responsive from 360px wide up. Target 60fps.
- State is persisted in `localStorage`. All game data lives in JSON under `src/data/` and is validated on load. Nothing is hardcoded in components.
- Respect `prefers-reduced-motion`. Replace the curl with a fade peel.

## 4. Items (placeholder-first)

The user will supply the real item scans (fries box, cups, burger box and so on, with 2026 branding). Until then, generate **clearly labelled placeholder items** and wire them through `src/data/items.json`:

```json
{
  "id": "big-mac-box",
  "name": "Big Mac",
  "image": "/assets/items/big-mac-box.png",
  "stock": null,
  "stickers": [{ "id": "s1", "x": 0.32, "y": 0.41, "size": 0.18, "rotation": 0 }]
}
```

- `x`, `y` and `size` are normalized to the item image. `stock` is `null` for unlimited, or a number.
- Swapping in a real item must need only a new image file and a JSON edit. Add a small dev-only sticker placement helper (click on the image to log normalized coordinates). Document it.
- Which items carry which stickers is not known. Ship 5 or 6 placeholder items with 1 to 4 stickers each, and document in the README that the user will replace them.

## 5. Odds and prizes: how to use the JSON

The source file `docs/prizes-and-odds.source.json` has `promotion`, `odds_basis`, `rare_stamp_caveat` and a `prizes` array. Each entry has: `category`, `prize`, `required_properties[{name, stamp_number}]`, `reported_rare_stamp`, `starting_prizes_available`, `odds_one_in`, `odds_display`, `notes`.

Categories and counts: Collect to win (10), Instant other (27), Instant food (6), Instant rewards points (6), Digital Bonus Play (29), Golden Prize Draw (11).

Write a build or seed script (`scripts/build-data.ts`) that converts this file into the runtime data (`src/data/prizes.json`, `src/data/odds.json`, `src/data/properties.json`). Keep the source file untouched.

**Two layers of results. Do not mix them up:**

1. **Stamps (properties).** There are 28 board properties, numbered #801 to #828. They are the things that get collected on the board. There is a list of them in `required_properties` across the Collect to win entries. The stamp names and numbers there are authoritative.
2. **Prizes.** Instant prizes (food, rewards points, gift cards, cash and so on), Digital Bonus Play, Golden Prize Draw entries, and Collect to win prizes. A Collect to win prize is **won when every stamp in its `required_properties` is collected.** Auto-detect this on the board and celebrate it ("Set complete: Nissan Kicks").

**Draw model.** Each sticker peel produces one outcome that is drawn by weight:
- Convert `odds_one_in` into relative weights (probability is 1 / odds_one_in). Entries with a null `odds_one_in`, such as the Golden Prize Draw, are not drawable. They are information only, or a rare bonus. Document the choice you make.
- Real odds are astronomically small for the big prizes. Provide a **"Realistic" mode** that uses the raw published odds, and a **"Fun" mode** with a compressed or boosted curve so the user sees variety. Make Fun the default and expose a toggle. Keep the RNG in a single module, so a seeded RNG can be swapped in for tests.
- The rare-stamp info (`reported_rare_stamp`) is **unofficial**. Display it only with the caveat text from `rare_stamp_caveat`. Make the rare stamps rarer in the draw, and add a rare gold shimmer on reveal.
- `starting_prizes_available` is a finite pool. In Realistic mode, decrement the remaining count on each win, and stop drawing a prize at 0. Show "X remaining" in the prize detail.
- Validate everything on load. Missing numbers, duplicate stamp numbers, weights of 0 or less and out-of-range coordinates should produce clear dev-time errors.
- Unit tests: the weighted distribution (seeded, over many draws), duplicate discarding, the Collect to win set-completion detection, pool depletion.

## 6. Board collection screen

- Render `monopoly-board.png` as the base. Overlay one hotspot per stamp (#801 to #828), defined by normalized `{x, y, w, h}` in `src/data/boardSpaces.json`. Spaces are on the outer ring, and the airports and highways are the dark and grey tiles. The board text is the reference for names.
- **Map the coordinates carefully.** Open the board image and work out each space's position. Then overlay the debug rectangles on the image and check them visually, with a `?debug=1` mode, before you call it done. A wrong position is the likely failure here.
- Uncollected spaces are dimmed and desaturated. Collected spaces are in full color with a gold glow. The unrelated board areas (the central "prizes on pack" grid) stay static.
- Duplicates are **auto-discarded** (never added twice). Show a "Duplicate, discarded" message.
- Show "X / 28 collected", and the progress for each Collect to win set (for example, "Lake Louise, Mackenzie River, Lake Athabasca: 2 / 3").
- Tap a space for a modal with the name, the stamp number, the color group, which set it belongs to, the prize at stake, and the odds.
- A Reset progress button with a confirmation. A "Share my board" PNG export.

## 7. The peel (the core feature, make it excellent)

Build it in an isolated module, `src/peel/`, with every tunable in one `peelConfig.ts`.

- A subdivided plane mesh is textured with the gold sticker front. Its back face shows a silver adhesive-backing texture. The prize card is revealed on the surface beneath.
- **Grab:** press near a sticker edge or corner (the "PEEL HERE" tabs on the artwork). The sticker then **stays attached to the cursor or finger** for the whole drag.
- **Curl:** a cylinder-bend of the mesh around a fold line. The fold position and angle come from the pointer's offset from the grab point. Add a specular highlight along the roll, and a soft contact shadow on the item underneath.
- **Speed sensitivity:** smooth the pointer velocity over a few frames and feed it to a spring and damping model.
  - Slow drag: the adhesive resists. The curl is tight, the sticker hugs the surface, and the peel is gradual.
  - Fast pull: the curl is looser and larger, the sticker flutters, and it whips off.
- **Release:** past about 60% peeled, or above the velocity threshold, the sticker tears free. It flies off with the last momentum, then fades out. Otherwise it springs back and re-sticks with a small bounce.
- Optional sound with a mute toggle: a rip sound whose pitch and volume scale with speed. Synthesize it with WebAudio or use a small bundled file with a permissive license. Remember the mute state.
- Handle multi-touch gracefully (one sticker at a time) and cancel on `pointercancel`.
- Add a dev page at `/peel-lab` with sliders for the constants, so the user can tune the feel.

## 8. Screens and flow

1. **Carousel (home).** Scroll through the items (wheel, drag, arrow keys, swipe). The centered card is enlarged and the others are dimmed. Each card shows the name and the sticker count ("4 stickers"). Click to pull one to the centre.
2. **Peel view.** The item is centered and large, on a dark background with a soft spotlight. The user peels each sticker. The reveal is a gold shimmer, a result card (stamp or prize, a "NEW!" badge or "Duplicate"), and an "Item complete" state with "Back to items" and "Pull another" (respecting `stock`).
3. **Board.** See section 6. There is a tab or route to it from the header.
4. Header: McDMonopoly wordmark, pulls-so-far counter, a history log, the mute toggle and the mode toggle (Fun and Realistic).

## 9. Visual design

- Background `#0a0a0a` with a subtle vignette. Accents: McDonald's red `#DA291C`, golden yellow `#FFC72C`, and the gold sticker tones. A clean, modern look in the style of the current McDonald's branding.
- Footer on every page: *"Unofficial fan-made simulator. Not affiliated with, endorsed by, or sponsored by McDonald's or Hasbro. All trademarks belong to their respective owners. Non-commercial."*

## 10. Quality bar

- Clean, typed, componentized code. No narration comments.
- Run `tsc --noEmit`, the linter and the unit tests, and they must pass.
- Test the real site in a browser: the carousel, a full peel (slow and fast, release early and late), the reveal, the duplicate flow, the board, the persistence after a reload, and a narrow mobile viewport. Record a short screen capture of the peel and the board as proof.
- A README that covers: how to run it, how to edit the JSON, how to replace the items, how to run the data script, how the draw modes work, and the Decisions you made.

## 11. Delivery order

1. Scaffold the project, the layout and the theme.
2. Peel prototype on one sticker plus `/peel-lab`, then **stop and show the feel**.
3. Data script, validation, the odds engine and the tests.
4. Carousel, item and peel flow with the placeholder items.
5. Board mapping with the debug overlay, collection, set detection, persistence.
6. Polish: sound, share PNG, reduced motion, mobile, README.

## 12. Known caveats to surface to the user at the end

- Real item scans and the item-to-sticker mapping are still needed.
- The prize-cards sheet is a design reference, not data.
- The real-world odds make big prizes effectively unwinnable, which is why Fun mode exists.
- Rare-stamp identification is unofficial.
- The McDonald's and Hasbro artwork is theirs. The site is a non-commercial fan project.
