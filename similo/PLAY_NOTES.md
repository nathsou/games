# Browser play notes

Recorded during implementation on 2026-10-03. These are direct play observations, not an automated suite. No tests were written.

## Live GPT-6 Luna play

OpenAI's Responses API was called from the actual browser with a personal key held in memory. Medium and high reasoning effort both worked. Each move used the rendered role-specific board image and the same request adapter shipped with the game. The key is absent from game saves, exports, source files and these notes.

Three complete fixed-hand games were played with the human partner reading only the permitted interface:

- **French History, AI clue giver:** loss in round five. The final positive king clue intended a political leader, but the human read it as a royal-court association and kept Molière instead of Robespierre. This motivated clearer fixed-hand planning, salient-meaning checks, and consistency with previous clues.
- **Scientists, AI guesser:** loss in round five. Both Grace Hopper and Ada Lovelace explained the mathematical/computing clue trail. The human intended Emmy Noether's glasses to separate Hopper from Lovelace. The AI favored the explicit mathematician label instead. Replaying that final position with revised instructions and enlarged portraits still produced the same choice. Visual ambiguity and excessive reliance on labels remain limitations.
- **Greek Mythology, revised AI clue giver:** win through all five rounds with Hestia as the target. Fire, goddesses and contrasts with the underworld and an armored warrior supported the result. Human and AI interpretations diverged along the way; the final Achilles/Different clue distinguished Hestia from Ares.

The prompt at that stage asked the giver to plan its remaining hand, anticipate a human's most obvious reading, avoid contradictory associations and reserve a useful final discriminator. The guesser was instructed to examine the portraits, treat profession labels as incomplete, compare all clues and contrast the last two candidates. Both roles receive only their own previously recorded explanations as memory. Human notes stay sealed even when the AI could benefit from them.

These few games demonstrate working live requests and identify failure modes; they do not establish a win rate. OpenRouter and Anthropic adapters were implemented against their provider documentation but were not exercised with live credentials.

## Direct interface play

- Invitation/reply exchange connected two browser tabs. Clues and removals synchronized, private information stayed off the guest's active table, and both browsers received the same final reveal.
- A complete five-round shared win followed the removal counts 1, 2, 3, 4, 1. A rematch reused the connection.
- The fixed hand decreased after every clue. The classic hand drew a replacement and stayed at five. Passing the device hid the secret and hand from the guesser.
- A completed replay was imported using the browser's file control and restored all five round views and recorded explanations.
- The final comparison dialog displayed both candidates and the latest clue; selecting a candidate marked it for removal and still required confirmation on the table.
- Desktop and phone layouts were visually inspected. The board kept stable card positions and the phone layout did not overflow horizontally.

Direct pairing was verified locally. Cross-network connectivity depends on the peers' networks; there is no TURN relay. Module syntax and whitespace checks were performed separately from browser play.

## Expansion to eleven themes

Five new 24-card decks add Singers, Actors, Cities, Countries and French Regions. All five galleries were opened in the browser and their crops and labels inspected. The regions deck includes all 18 present-day regions and six labelled historic regions. The eleven-deck setup and place-card board fit a 390-pixel phone viewport without horizontal overflow. Card inspection was corrected to show a large portrait or landscape on phones, including the historic-region label.

A complete live GPT-6 Luna game used a Cities board, a fixed Countries hand and high reasoning effort. It ended in a shared win with Beijing as the target. China and Japan supported the East Asian connection; Spain and Saudi Arabia supplied contrasts; Morocco's blue architecture distinguished Beijing's blue temple roof from Seoul's green roof and pink blossoms in the final round. This verifies a working place-aware, mixed-deck game; it remains one play observation, not a win-rate estimate.

One-screen play was also opened with a French Regions board and Singer clues. The board dealt twelve cards, the classic hand held five, and playing a singer clue passed through the privacy curtain to a guesser view with the hand and secret hidden.

The game now loads native-browser-encoded WebP delivery copies (8,832,934 bytes total), retaining the original generated PNGs (37,471,039 bytes total). Delivery images preserve dimensions and composition and reduce the image transfer by about 76%. No dependencies or tests were added.

## Dates and descriptions

All 264 card records now include a date caption and short public description. A direct read of the loaded browser catalog confirmed complete coverage. Card IDs and atlas positions remain unchanged, and subjects appearing in multiple decks share one context entry.

The collection and inspection dialog were opened with the new captions. Hypatia's approximate birth dates and fuller explanation were visually inspected at 1440-pixel desktop and 390-pixel phone widths; Paris's labelled Eiffel Tower milestone was also inspected on the phone. The phone dialog fit without horizontal overflow. Caption wording was reviewed for ordinary lifespans, labelled birth years, traditional ancient dates, place milestones, historic regions and myths.

The AI's permitted board, public clues and giver hand now include this same context, and its prompt explains the date conventions. No new live provider game was played for this metadata change. References and editorial conventions are recorded in `CARD_CONTEXT.md`. No tests were written.

## Balanced clues, music and outcomes

The generic inspection advice was removed, leaving the subject's role, date caption and short biography. The updated dialog was visually inspected in the browser.

The prior prompt encouraged repeated contrasts and gave appearance priority in a final-round tie. The replacement gives equal consideration to role, era/dates, geography, stories, supported traits and appearance; it compares both signs and checks for confusion across dimensions. Three identical opening positions were sent to GPT-6 Luna at medium effort with each prompt. Both produced two Similar moves and one Different move. A full subsequent French History game ended in a fourth-round loss with Joséphine Baker as the target, exposing an unintended Enlightenment-era reading of its activism clues. Direct target anchoring and accumulated-pattern checks were added; revisiting the ambiguous second round selected a concrete monarchy contrast. Details and limits are recorded in `AI_CLUES.md`.

All eleven original eight-bar scores were rendered with native OfflineAudioContext. At the default music level, measured left-channel peaks ranged from 0.0474 to 0.0843 and the loops produced audio without browser errors. The French History and Regions bass accompaniment was subsequently adjusted to emphasize the waltz downbeat. Actual theme playback used a running AudioContext after a trusted pointer gesture. The music-volume control and master mute/unmute were used during play; the provider key remained absent from saved settings.

A complete five-round one-screen win and an immediate one-screen loss were played through the controls to inspect their outcome transitions. Victory and loss dialogs were visually inspected at desktop and 390-pixel phone widths, and the loss summary clearly named the removed secret and round. Moving between replay rounds did not reopen the result dialog. A further phone loss with reduced motion enabled retained the clear result while its card animation was absent and its canvas effect was skipped. Switching among French History, Cities and French Regions kept the audio context running and changed the displayed composition. The effects follow both the local effects preference and reduced-motion setting. Music and result cues are synthesized locally without downloads or dependencies. No tests were written.
