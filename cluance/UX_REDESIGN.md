# Cluance UX/UI redesign

The supplied **Cluance redesign from ground up** handoff is the visual reference. The high-fidelity screens and tokens were implemented in the existing vanilla ES-module app; the Current and Wireframes prototypes were comparison material. The attachment's runtime, old atlas copies, remote font loading and static game data were not imported. Live collection counts use the expanded roster: **354 cards, 11 decks: 54 Musicians and 30 in each other deck**.

## Implemented surfaces

- Home: role/partner/deck sentence tokens, independent clue deck and hand variant, responsive pickers, three distinct selected-deck hero cards, resume pill and replay import. Invite and join actions are available in every setup mode; inviting switches to giving clues and preserves the chosen decks and variant. Long sentence tokens wrap on phones.
- Guesser: proportional round progress, six-by-two desktop/four-by-three phone board, upright/sideways clue trail, sealed-note control, removal count, clear and named confirmation.
- Giver: secret thumbnail and gold ring, compact board, private hand fan, pointer dragging and tap/keyboard direction selection, clue/note controls inside the desktop drop zone and a phone action bar. The private hand remains visible for inspection while the partner guesses; drop zones are hidden and clue submission is unavailable until the next clue turn. Waiting/error states use the action bar.
- Reveal: outcome moment, board as it stood in each round, round removal tags, expected-removal match/mismatch chips when recorded, both interpretations and per-card reasons, arrow-key scrubber, autoplay, rematch/swap and replay export.
- Pairing: explicit **Create invitation** action followed by **Invitation ready**, plus **Create an invitation instead** from the join dialog and **Join instead** from the host dialog. Existing shared invitation/reply/QR/share flow, collapsed manual reply and connection settings, optional matching clipboard reply banner. TURN credentials remain in memory for the current visit.
- Details: right drawer with arrow browsing, marking, latest-clue comparison and up to two pinned candidates; optional hover/long-press Peek. Closed drawers and covered handoffs remove their contents.
- Collection: searchable full page, deck chips, date/order sorting, biography inspection and Play this deck.
- Settings: Game, AI partner, Spending and Network tabs; self-hosted typography, appearance and size segments, details previews, music volume, sound and reduced-motion controls. Existing provider, key, reasoning, token-budget, pricing and usage controls remain functional.
- One screen: full-page privacy curtain, 800-ms hold with pointer/Space/Enter, early-release reset, seat swap and accessible confirmation fallback.

The eleven original music cues, outcome canvas, game engine, AI observation/privacy projection, storage migration and replay/network formats are retained. Reduced-motion preferences suppress decorative animations. Art crops respect supplemental atlas geometry and subject redraw overrides. Different clues remain sideways in the rail, drop zone, comparison and replay.

## Browser verification

Verification uses temporary Playwright scripts with system Chromium; no test dependencies or test suites were added to the project.

- Inspected all nine surfaces, Light/Dark appearance, the expanded collection and the Babbage/Sartre/Camus searches.
- Completed a real five-round fixed-hand local game with Scientists/Philosophers, the new subjects, alternating directions, pointer drag, sealed notes, final comparison and a win.
- Checked early-release and completed holds, keyboard controls, settings persistence, drawer navigation/marking and removal of private DOM during every handoff. Guesser views contain neither the private hand nor secret marker.
- Exported/imported the resulting replay, stepped with arrow keys and autoplay, inspected expected-removal chips, completed a loss, and opened the archived-region replay.
- Checked home, giver and guesser layouts at 1440×900, 1366×768, 1024×768, 820×1180, 390×844, 375×667 and 320×568 without horizontal overflow. The reference 1440×900 table and 390×844 phone table fit vertically; shorter screens allow vertical scrolling.
- Intercepted provider requests to verify thinking, cancellation, retry, provider-error display, AI settings shortcuts and role-filtered UI without paid API calls.
- Native pairing generated/accepted real validated invitation/reply links and rendered QR codes. This managed environment produced no WebRTC ICE candidates, so a live data channel could not be established here. A temporary BroadcastChannel transport stand-in, retaining the real invitation parser and game flow, verified connected host/guest rendering, synchronized clue/removal moves and guest privacy. The production WebRTC transport is unchanged.
- Invitation follow-up: checked invite/join discovery in all five stored setup modes at four desktop/phone widths, generated and copied a native invitation from the guessing setup, and opened it in a second tab to generate a matching reply. Checked distinct card IDs and rendered images in all eleven home fans and no identical rendered card images within any of the eleven active decks (330 cards).
- Module syntax and whitespace checks passed with no browser JavaScript errors in completed checks.
- Musicians expansion: all 24 new cards were reviewed in both renderers and opened through collection search and details, with 54 distinct images in the pack and 354 active cards overall. Both collection sorts and four desktop/phone widths pass. Five-round classic and fixed-hand games using the new cards completed through the actual UI and their exported replays reopened. The original card records and `singers` IDs are unchanged.

## Review screenshots

[Home](screenshots/redesign-home.png), [guesser table](screenshots/redesign-table.png), [phone table](screenshots/redesign-phone.png), [giver table](screenshots/redesign-giver.png), [dark giver table](screenshots/redesign-giver-dark.png), and [reveal](screenshots/redesign-reveal.png). The French table examples use a reproducible demonstration position; the replay capture is from the completed expanded-card browser game.

Invitation follow-up: [Cities home](screenshots/redesign-cities-home.png) and [invitation link](screenshots/redesign-invitation.png).

Explicit invitation creation: [desktop](screenshots/invitation-create-desktop.png) and [phone](screenshots/invitation-create-phone.png). Native offer/reply generation, clipboard copying, matching-room acceptance, role switching and invalid-reply recovery were checked; live connectivity remains unverified in this environment, which produced zero ICE candidates.

Clue-giver hand during the partner’s guess: [desktop](screenshots/giver-waiting-hand-desktop.png) and [phone](screenshots/giver-waiting-hand-phone.png). Both hand variants were checked for visible cards, inspection, turn restrictions and private-hand exclusion from the guesser view.
