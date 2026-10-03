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

## Card controls, appearance and decision memory

Board and private-hand cards now have a separate Details button. Opening it shows the artwork, dates and biography without changing the selected move. A selected Joan of Arc remained selected after opening and closing its details on a 390-pixel phone. The visible button replaces the need to discover a right-click or keyboard shortcut; those shortcuts remain available. Clue cards open their details directly.

The table offers Compact (112 px), Comfortable (160 px, the default) and Large (208 px) card widths, with the choice also available in Settings and saved locally. The board rearranges to fit the chosen width. Desktop and phone views were visually inspected, including a large-card table at 1440 pixels and compact/large views at 320 pixels. The 390-pixel Comfortable board showed two columns and 160-pixel cards without horizontal overflow. Clue-trail cards are substantially larger, wrap across rows and carry readable subject names; a sideways clue remained within its token at 320 pixels.

Light mode uses cream surfaces and dark lettering throughout the table, controls and dialogs. Dark and System are also selectable. With an emulated dark operating-system preference, an explicit Light choice remained light. Saving System switched to dark; changing the emulated preference to light updated the page and its theme-color metadata without reloading. The choices persist locally.

The top button now pauses only background music. Using it saved music off while sound effects remained on. A subsequent trusted pointer selection created a sound oscillator in a running AudioContext with music still off. Settings continues to expose independent music and effect switches and music volume. Older saved master-mute preferences are migrated to both switches off to preserve silence.

Recorded French History giver and Scientists guesser positions were reconstructed for direct request inspection. The actual OpenAI, OpenRouter and Anthropic request builders serialized three earlier giver actions/explanations and four earlier guesser actions/explanations respectively. Giver records contained clue IDs, names, directions and public removals; guesser records contained removed IDs/names and received clues. No partner notes appeared in these payloads, and guesser requests contained neither the target nor private hand. No provider requests were sent for this inspection; the existing live-game observations above remain the evidence for provider gameplay.

Module syntax and whitespace checks passed. No tests were written.

## Spending and the 2015 regional division

The active Regions deck now has 27 original illustrations, one per region in the division on 31 December 2015: 22 metropolitan regions and five overseas regions. The complete gallery was opened and its cell crops inspected. Mayotte's illustration, date caption and public description were inspected at 390 pixels. A one-screen deal used only the new `regions-2015-*` IDs, with twelve board cards and five private cards. Playing a clue and deliberately removing the remembered secret exercised the loss transition. Legacy regional subjects, IDs, descriptions and their original atlas remain readable for older saves and replays; they are excluded from new deals. The active catalog has 267 cards, with complete metadata on the new region records.

One actual GPT-6 Luna giver request used the new region board and fixed hand at medium effort. It selected Alsace/Similar. The response reported 4,867 input tokens, including 1,247 cache reads and 3,617 cache writes, plus 937 output tokens of which 873 were reasoning. Three input tokens were uncached. Using the verified captured standard rates, the request estimate was $0.000933395. The game and Settings panel displayed $0.000933, with a clearly labelled rough five-round guide of $0.004667. This was one move, not a complete AI game or a general quote for future games.

The estimate survived a page reload with no provider keys saved. A separate completed one-screen game appeared with zero requests and zero spending, and the global total stayed $0.000933395. The populated usage panel was visually inspected in light and dark modes on a 390-pixel phone. Its game/cost columns fit inside the panel without horizontal scrolling; request and token details remain visible within each row. Desktop empty-state and region-gallery views were also inspected.

The public OpenRouter model list returned 295 image-capable models and catalog prices, without using an OpenRouter key. Numeric catalog rates are converted from per-token to per-million values for the pricing controls. Custom-rate controls displayed a visible validation error when only the input rate was supplied; adding the output rate saved the custom price. The prior live request retained its original captured rates and unchanged cost. No OpenRouter or Anthropic move requests were made for this change. Their accounting branches follow the provider schemas cited in `API_USAGE.md`.

Usage is local to this browser and origin. Earlier spending cannot be backfilled; missing responses, prices and interrupted requests remain unknown rather than being reported as free. The raw records contain no keys, pictures, prompts or sealed notes. All twelve WebP files, including the retained legacy region atlas, total 9,729,324 bytes; the preserved PNG originals total 40,835,628 bytes. The new atlas uses 896,390 WebP bytes versus 3,364,589 PNG bytes. Its complete prompt and generation provenance are in `assets/PROMPTS.md`.

Module syntax and whitespace checks passed. No tests were written.


## Intended removals and explicit decisions

The reported Dumas/Molière final pair was reconstructed with La Fontaine/Different as the latest clue and the actual enlarged vision image. The complete earlier trail was not available, so this was a controlled final comparison rather than a replay of the original game. A live GPT-6 Luna guesser request at medium effort returned keep Dumas/remove Molière, supported by role, dates and stories. Its explanation explicitly named both choices, and applying the returned IDs produced a win. A corresponding live giver request, with Dumas as the target, Molière as the alternative and La Fontaine as the available clue, selected Different and predicted Molière's removal, using era and role.

The giver's active public projection contained only round, active cards, clue ID, direction and public removals. Its prediction, dimensions and explanation appeared in its own decision memory but not the guesser's observation; that observation had no target. Both actual responses passed the new partition validation and provider schema without a correction request.

The new reveal was opened through the replay import control. Expected removals, supporting connections and actual removals were visible on desktop and at 390 pixels; the phone had no horizontal overflow. This is evidence that the reported final comparison now yields a coherent action/explanation in these live calls, not a guarantee for all future interpretations or a measured win rate.


A subsequent real fixed-hand Writers game used the new keep/remove format for four giver turns, all accepted without correction. The human moves were chosen from public clues and card context, without inspecting the target or giver notes until the game ended. It lost in round four with Oscar Wilde as the target. Kafka/Similar used a transformation-story connection; Tolstoy/Similar and Austen/Similar emphasized the 19th century, and Sand/Similar gave little additional discrimination. The fourth-round explanation even highlighted Hugo's French connection, although that was absent from Wilde. The expected-versus-actual lists made this ambiguity visible rather than treating predicted removals as necessarily convincing.

The prompt was then tightened to require a brief factual reason for every predicted or actual removal and to reject equally shared traits as a justification. Repeated broad categories cannot distinguish peers already sharing them. Revisiting that actual fourth-round position with the same earlier clue trail and two-card hand selected Sand/Different, supported by role, geography and dates. It predicted removing Dostoevsky, Hugo, Goethe and Shelley, leaving Dickens and Wilde; each removal had a specific explanation. This was a fresh live Luna request at medium effort and passed the final schema without correction. It is an improvement in the clarity of the distinction, not proof that the human would necessarily choose those same four removals.

A second live guesser request reconstructed the Dumas/Molière comparison with the final per-removal format and reversed survivor order. It again kept Dumas and removed Molière, explicitly citing the era contrast and explaining Molière's removal. No correction was needed. The full earlier user game remains unavailable.


Applying the revised fourth-round predicted removals created a follow-up final position with Dickens and Wilde and Homer as the remaining hand card. One live medium-effort giver request chose Homer/Similar, using the public poet subtitle to distinguish Wilde from Dickens and predicting Dickens's removal. Applying that prediction yielded a win. This branch used the model's predicted removals to inspect its final discriminator; it was not a second independently played full game. The fifth request included the earlier predictions, per-card reason entries and public responses as the giver's own memory.


The final reveal with four per-card reasons was visually inspected on desktop and a 390-pixel phone, with no horizontal overflow. An older five-round replay loaded through the normal file control and labelled missing predictions as unrecorded. All three provider request builders were inspected at the revised final position: the giver received four own moves and four recorded per-card reasons from the revised round, while the guesser received neither private hand, target nor partner explanations. No additional OpenRouter or Anthropic move requests were sent. Module syntax and whitespace checks passed. No tests were written.
