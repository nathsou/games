# Browser play notes

## Forty-card theme expansion — 4 October 2026

Added 100 original illustrated subjects to reach 453 active cards: 40 per theme, with Musicians retaining 53. Each addition was inspected in both production crops, searched and opened with matching details; all expanded galleries have 40 distinct images and fit desktop/phone widths. All 377 existing active and archived records remain unchanged.

968 complete engine games covered every board/clue theme pairing in Classic and Fixed five, with every addition dealt onto a board and into a hand. Two complete Chromium UI games used the new Greek board and Writers hand, including private guesser projection, reload/resume, replay export/import and all five replay steps. A legacy archived-region replay also opened. Browser checks passed again after updating with current main; four complete server Take turns games also passed with new Regions/Scientists cards in both creator roles and variants. No browser or HTTP asset errors occurred. Static-site assembly, module syntax and whitespace checks passed. These card checks did not require paid AI calls or live cross-network multiplayer. [Individual card findings and provenance](FORTY_CARD_EXPANSION.md) document all replacements.

## Invitation roles and online role swaps — 4 October 2026

Creating an invitation preserves the selected guesser/giver role. The invitation carries the creator’s role and public board deck, clue deck and hand variant; the recipient takes the opposite role. Native SDP offer creation remains independent of who gives clues. Legacy invitations without setup metadata retain their original creator-as-giver behavior.

Either online player can choose **Swap roles & deal** from the table menu or final reveal. Their friend must accept before a fresh game replaces the current one. The existing connection stays open. The original giver coordinates the handover and retires the old private session; the new giver creates the fresh secret and hand locally and sends only the validated public table. Declines, cancellation and expired requests keep the current game. A cancellation crossing a committed handover completes the agreed swap, preventing two authorities.

Chromium checked both creator roles with Classic and Fixed five, using a Musicians board and French History clues. Every case covered correct roles/settings, private-field exclusion, decline/cancel, swaps initiated by each role, clue/removal synchronization after each swap, waiting-hand inspection, end-game swaps and the phone menu. Connection object counts stayed unchanged. Additional checks covered simultaneous requests, cancellation crossing commit, disconnect during an unaccepted request and confirmation dialogs at 390×844 and 320×568 with no document or dialog horizontal overflow. No browser errors or failed assets occurred.

Connected checks used a temporary BroadcastChannel transport stand-in with the real application, game engine, invitation parser and native pairing codec. Separate native WebRTC checks created/copied a guesser’s invitation, generated the giver’s reply and accepted it with matching room IDs; the environment produced zero ICE candidates, so live cross-network connectivity remains unverified. Native metadata checks also covered both roles, legacy links and rejected invalid settings. Existing shared pairing/QR checks, module syntax and whitespace checks passed. No test suite or dependencies were added.

## Clue-giver hand while waiting — 4 October 2026

The clue giver's current hand stays visible and inspectable while the partner guesses. The waiting layout hides only the Similar/Different drop zones, centres the hand and shows an inspection hint. Existing turn checks prevent selecting, dragging or submitting another clue until the next clue turn.

Chromium restored real engine-created multiplayer-host positions after a clue in both Classic and Fixed five. At 1440×1000, 1024×768, 390×844 and 320×568, every remaining hand card was visible, with five Classic cards and four Fixed five cards. Clicks opened the matching card details; keyboard shortcuts did not change the game while waiting. After applying a legal guess through the engine, the next clue turn restored both drop zones and the submission form. No horizontal overflow, browser errors or failed assets occurred. Module syntax and whitespace checks passed.

Guesser projections still omit the private hand, secret and draw pile. Both the covered one-screen handoff and the revealed guesser view contain no private hand/secret elements. These checks used saved host fixtures; they did not require a live WebRTC connection or provider calls.

## Explicit invitation creation — 4 October 2026

The host dialog now waits for **Create invitation**, then displays **Invitation ready** with copy/share/QR controls. A player who opened the join dialog can choose **Create an invitation instead** to become the clue giver; the host can choose **Join instead**. A cancelled or superseded invitation cannot report its late preparation error in a new dialog.

Chromium followed join → create instead → create → copy a real native offer link, opened it in another browser context to generate/copy the native reply, and verified the host accepted the matching reply as its remote description. Decoded links contain only protocol/type/SDP/room, with matching room IDs and no game, secret, hand or key fields. Checked creation at 390px and 320px, host-to-join switching, invalid-reply recovery and fresh invitations. No browser or asset errors occurred. Shared pairing-codec and QR tests, module syntax and whitespace checks passed.

This managed environment produced zero WebRTC ICE candidates in both descriptions, so a live data-channel connection could not be verified. The production WebRTC transport is unchanged. These checks verify creation, copy, reply generation and acceptance, not cross-network connectivity.

## Musicians expansion — 4 October 2026

The renamed Musicians pack now has 53 cards, bringing the full collection to 353. It adds 23 artists and bands; Serge Gainsbourg retains his existing card once. Billie Eilish was removed at the user's request, including both symbolic artwork files. Her former `singers-39` slot is unused. Every remaining card record, ID and artwork mapping was compared with the preceding roster and is unchanged.

The retained additions were individually inspected in the production full-bleed UI and labelled AI renderer, including faces, member counts, instruments, crops, captions and distinguishing visual cues. Angine de Poitrine's corrected mask shapes, nose directions and dot sizes reference a stage photograph on the band's official biography page. The second additions review sheet was refreshed after removing Billie.

After removal, both Classic and Fixed five deals were checked to exclude the removed card, all remaining asset mappings resolve, and the collection loads 53 musician cards and 353 cards overall. Billie Eilish is absent from search and the card registry. The 53 musician images remain distinct. Module syntax and whitespace checks passed, with no browser or asset errors.

Earlier expansion verification, before the removal, opened every addition through search/details, checked both collection sorts and layouts at 1440×900, 1024×768, 390×844 and 320×568, completed Classic and Fixed five-round UI games and exported/reopened their replays. Six engine games covered both variants and mixed musician/French board-clue packs; public views exclude the secret, hand and draw pile. No paid provider calls were needed.

## 30-card collection audit — 3 October 2026

The expanded collection has 330 active cards, 30 per theme. All eleven collection galleries were opened in Chromium at 1440 × 1000 and checked at 390 × 844; every accessible label was matched to its subject and date caption. Babbage, Sartre and Camus were opened in the inspector and their biographies checked. There were no browser JavaScript errors or failed asset requests.

All 330 active cards and 24 archived region cards were rendered through the production Canvas renderer at 288 × 392 and visually inspected individually on full-card contact sheets. [CARD_AUDIT.md](CARD_AUDIT.md) records a specific finding for each card, including rejected generations and the accepted redesigns.

A one-screen Fixed five game used a Scientists board containing all six additions, with Babbage as the target and new Philosophers as clue cards. It completed all five rounds through the actual UI, alternated Similar/Different clues, hid the private hand from the guesser, survived a reload/resume after round two, opened the final-two comparison and reached the victory dialog. The exported replay reimported with its five rounds and Babbage target intact. An independently created old-format `similo-arcade-replay` with archived `regions-0`–`regions-16` IDs also imported and displayed the original region artwork correctly.

Temporary direct checks completed 242 five-round deals: all 121 board/clue combinations in both hand variants, including subject exclusion across overlapping themes. They also compared every pre-expansion ID/name/index with the original roster, checked all date/description fields and confirmed that each atlas index is in range and each artwork file exists. Module syntax and whitespace checks passed. No test files or dependencies were added. These checks validate the expanded collection and rendering; no paid provider calls were needed for this artwork change.

French Regions retains the complete 27-region administrative set of 2015, plus three explicitly labelled historical provinces to reach 30 cards. Its collection description and individual province captions distinguish the two kinds of subject.

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


## Cluance rename and main-branch integration

Merged the current main branch, retaining the shared AI/provider, preference and usage integration together with the latest keep/remove schema, per-card removal reasons and sealed decision memory. The only textual conflict was in the provider request builder; the final version passes the complete Cluance schema and instructions to the shared transport.

A live GPT-6 Luna medium-effort giver request used the merged adapter with Dumas as the target, Molière as the alternative and La Fontaine as the hand card. It chose Different, predicted Molière's removal and supplied a per-card reason. A subsequent guesser request received only the public observation and image, kept Dumas, removed Molière and completed a win with a coherent explanation. Both requests passed without correction, and the shared ledger recorded two completed turns with a combined estimate of $0.001923725.

The renamed title, C emblem, Cluance wordmark and favicon were inspected in the browser, including narrow phone layouts. The preview loads the repository's shared modules. Actual legacy settings migrated to the new namespace while retaining Light appearance, Compact cards, music off and sound effects on. An ongoing saved fourth-round game migrated, resumed through the privacy curtain, accepted the four-card human move and reached its loss/reveal screen.

A replay exported through the real button downloaded as `cluance-writers-2026-10-03.json` with the `cluance-replay` format. Its public snapshot contained neither private hand nor keys. A five-round legacy replay loaded through the unchanged file control. The static collection card links to `cluance/` and its renamed atlas path; the old `similo/` page redirects while preserving query parameters and the fragment. Original-game credits and legacy migration identifiers remain intentionally unchanged.

No tests were written. Module syntax and whitespace checks passed; this verification used direct browser actions and live provider requests.


The legacy `similo/` folder and its deployment and preview redirects were subsequently removed at the user’s request. Cluance remains at `cluance/`; saved-data and replay compatibility are unchanged.


## Cloudflare invitation checks

The hosted invite now uses a short, expiring link and exchanges SDP/ICE automatically, removing the reply-link step. The manual flow remains available with explicit clipboard actions. Browser checks at 1280, 390 and 320 pixels found no horizontal dialog overflow or page errors. Typed replies, relay credentials and expanded sections survived status/error updates; relay passwords were absent from saved preferences. Switching invite/join modes closes the previous pending connection.

A browser RTC substitute exercised gameplay through real Cloudflare local Worker/WebSocket signaling: inviter roles were preserved, only the giver saw the secret/hand, a clue and elimination synchronized, and an agreed role swap kept both peers on the same new game. Native Chromium independently generated and applied real offers/answers automatically. This environment produced no usable native ICE candidates, so native data-channel and remote-network connectivity need verification with the configured Cloudflare account/TURN service. The substitute is test tooling and is excluded from deployed assets.
