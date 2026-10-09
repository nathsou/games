# Cluance

A cooperative visual deduction game with original retro pixel art. Play with a friend through a shared room, or with a vision-language-model partner in either role. Built with native browser APIs and Canvas 2D. The browser game needs no packages, CDNs, frameworks or compilation. Martian Mono and DM Mono are self-hosted with their SIL OFL licences. The collection’s Cloudflare Worker provides automatic friend-invite signaling.

The interface follows the supplied [UX/UI redesign](UX_REDESIGN.md), with paper tones, full-bleed artwork and self-hosted mono typography.

Startup applies the saved appearance before the first styled paint and includes a
small HTML loading layout. Card artwork loads and decodes on demand, with shared
requests for cards in the same atlas. Opening the default home screen downloads
two atlases (about 1.4 MB), rather than every deck (about 34.3 MB). A failed atlas
can be retried on its card without blocking the rest of the interface. AI
observation images wait for all artwork visible to that role before rendering.

## Run

From this directory:

```sh
node tools/serve.mjs
```

Open <http://127.0.0.1:4173>. Optionally set `PORT` to use another port. The preview server uses only Node's standard library. Any static HTTP server also works; ES modules require serving over HTTP rather than opening `index.html` as a local file.

## Cloudflare hosting

The collection builds a clean `_site` directory for Cloudflare Workers Static Assets, with the game's files and the shared runtime. See [Cloudflare setup](../docs/CLOUDFLARE.md) for Git build settings. From the repository root, run `npm run build` and `npm run dev` to play with a friend locally.

AI mode makes browser requests directly to the selected provider. Games with a friend run in the room's Durable Object, which sends the clue giver's secret and hand only to the clue giver and keeps both players' reasoning sealed until the reveal. On an ordinary static host or the preview server, solo and one-screen play work without the Worker.

## Play

- **Play with a friend:** **Invite a friend** opens the Play together window's setup sheet: your role, decks and hand variant. Your friend takes the opposite role and gets a request to join. The game runs on the room's server, so it plays live when you're both at the table and waits when one of you leaves. See [playing with a friend](../docs/FRIEND_SESSIONS.md).
- **Guess the AI's card:** the AI knows the secret and chooses one clue card and its direction each round.
- **Give clues to AI:** you know the secret and play clues; the AI chooses cards to eliminate.
- **Play again or swap roles:** after a game with a friend, **Play again** or **Swap roles** opens a new game's setup with the same decks; the finished game keeps its result.
- **Play on one screen:** the guesser's public view opens immediately after a clue. Hold to reveal the clue giver's secret and hand when switching back. No provider key is required.

The board has twelve illustrated people or places. The clue giver starts with five cards and plays one as **Similar** (upright) or **Different** (sideways). The guesser eliminates **1, 2, 3, 4, 1** cards across five rounds. Removing the secret loses immediately; leaving it alone wins. Clues accumulate and remain relevant.

**Classic hand:** draw one replacement after each clue. **Fixed five:** no replacements; use the initial five cards in a considered order.

Twelve decks with **541 active illustrated cards: 101 French Departments, 53 Musicians, 40 in each of nine expandable themes, and the 27 administrative French Regions of 2015**. French Regions intentionally keeps its accurate 27-card roster. Scientists includes Charles Babbage, Philosophers includes Jean-Paul Sartre, and Writers includes Albert Camus. Every existing and new card has an individual audit record in the [original audit](CARD_AUDIT.md), [40-card expansion review](FORTY_CARD_EXPANSION.md) or [Departments review](DEPARTMENTS.md); inconsistent artwork was redrawn from scratch with imagegen.

1. French History
2. Global History
3. Greek Mythology
4. Scientists
5. Philosophers
6. Writers
7. Musicians
8. Actors
9. Cities
10. Countries
11. French Regions
12. French Departments

Cities include Paris, Rome, London, Berlin, Tokyo and New York City, with 34 more cities worldwide. French Regions contains the complete division as it stood on 31 December 2015: [22 metropolitan regions](https://www.insee.fr/fr/statistiques/1906658), including Corsica, and five overseas regions. Historical provinces and territories are excluded from this pack. Every card has one original illustration, dates and public context. Centre-Val de Loire uses its [name adopted in January 2015](https://www.legifrance.gouv.fr/loda/article_lc/LEGIARTI000030110734). New deals exclude the merged post-2016 regions. Old region IDs and their artwork are preserved only for compatible saved games and replays.

French Departments is a separate 101-card deck using the [government geography API’s official names and codes](https://geo.api.gouv.fr/departements?fields=nom,code,codeRegion): 96 metropolitan departments, including 2A and 2B, and five overseas departments. Codes, local landscapes and creation-year captions are documented in the [individual Departments review](DEPARTMENTS.md).

Every card displays a date caption and has a short description available in card inspection. People have lifespans or labelled birth years; bands have formation/activity dates; places have labelled landmarks or milestones. Approximate and traditional dates are marked, and mythological figures are identified as myths. The [card context notes](CARD_CONTEXT.md) explain these conventions and link selected references.

Choose board and clue decks independently, including people/place combinations. When themes overlap, clue cards depicting the same subject as a board card are excluded. The opening sentence chooses your role, partner, board deck, clue deck and hand variant. Collection is a searchable full page with all 541 cards. Musicians includes solo artists and bands; Serge Gainsbourg is retained once, and the deck keeps its original `singers` identifier so old saves and replays remain compatible. All decks use smaller WebP delivery images; generation prompts and original output identifiers are recorded in the artwork provenance documents; only WebP runtime assets are retained in Git.

Select cards with a mouse, touch, or keyboard. The table keeps the board and clue trail together, with the giver’s hand between Similar and Different drop zones. Tap a hand card then a zone, or drag it there. While the partner guesses, the clue giver can still see and inspect their private hand; the clue controls return on the next clue turn. Arrow keys browse the hand; **S**/**D** choose a direction and **Enter** plays the selected clue. Different clues stay sideways throughout the table and replay.

Click the **ⓘ** affordance on a card, right-click, double-click or press **I** to open its details drawer. Use **←/→** to browse, **M** to mark an eligible card, and **Esc** to close. Compare the latest clue with up to two candidates, including the final two. The AI observation retains its explicit labels and final comparison. Settings offers Drawer or Peek details, Compact/Comfortable/Large cards, Light/Dark/System appearance and Reduce motion. These preferences are saved locally; System follows operating-system changes. Reduced-motion preferences disable animation.

One-screen play removes card elements while covered. Hold the reveal ring for 800 ms with a pointer, Space or Enter, or use the confirmation fallback. Closed drawers also discard their artwork. Explanations remain sealed until the game ends. The reveal scrubber supports arrow keys and 1.6-second autoplay, compares expected and actual removals when recorded, and exports compatible JSON replays.

Each board theme has an [original WebAudio composition](MUSIC.md), with music starting after a user gesture and pausing in hidden tabs. The top music button pauses only background music, leaving the sound-effects setting unchanged; Settings offers a music-volume slider and a sound-effects switch. Wins and losses open an explicit result dialog with the revealed card, a brief celebration or falling-card effect, and a corresponding musical cue before opening the sealed interpretations.

## AI settings

Open **Settings**, choose OpenRouter, OpenAI, or Anthropic, and supply a personal key. Keys are stored in this browser's local storage when **Remember keys** is selected; otherwise they remain in memory for the visit. **Forget all saved keys** removes them. Browser storage is not a secret vault and is shared by pages on the same origin. Keys are sent only to the corresponding fixed provider endpoint and never included in multiplayer messages, saved games, or replay exports. Environment files are ignored by Git.

Choose an image-capable model by exact model ID or load the provider's model list. OpenRouter's list is filtered to image-capable models; OpenAI and Anthropic model lists do not establish all modality or effort capabilities, so select a known vision model. The initial OpenAI model is `gpt-6-luna`; OpenRouter uses `openai/gpt-6-luna`. Models and availability depend on your provider account.

Reasoning effort is configurable, including a **Provider default** option that omits the parameter. Support varies by model; unsupported choices produce a visible error rather than being silently altered. A separate response-token budget accommodates reasoning tokens. Requests can be cancelled or retried. Invalid model moves get one correction attempt without advancing the game. Provider failures preserve the turn and show a retry/settings action.

Every AI decision gets a freshly rendered image of its permitted board, public clues, and, for the giver, its hand and target. A matching observation supplies IDs, names, public dates and descriptions, elimination status and legal move counts. The model also gets explicit records of its own earlier actions and short explanations. Giver records include the clue, direction, expected removals, supporting dimensions and public removals in response; guesser records include its kept/removed cards, supporting dimensions and the clue it received. This decision history accompanies the complete public clue trail on every request, even after resuming a saved game. It never receives its partner's sealed explanations. The guesser receives no target, private hand, or draw pile. There is no persistent provider conversation that could accidentally leak a previous role's private information. The OpenAI Responses adapter sets `store: false`.

The game requests a brief player-facing explanation with the decision. This is a contemporaneous explanation of the association, not an internal reasoning transcript. Human notes are optional. Both are sealed during play and shown round by round at the end. AI giver explanations include a recorded **Expected removals** list with a short reason for each predicted removal, compared with **Actually removed** in the reveal. AI guesser explanations show the cards it chose to keep and a short reason for each removal. Missing intentions in older replays or human notes are labelled as unrecorded. Save a replay as JSON and reopen it from the opening screen; replays contain no credentials.

The AI is instructed to give equal consideration to roles and jobs, dates and era, geography, history and stories, supported traits, and appearance. Each AI move explicitly partitions the surviving cards into keep/remove lists, checked for correct counts and complete, disjoint coverage before applying the move. This prevents structurally contradictory lists but cannot guarantee a correct interpretation or agreement with every sentence of the explanation. The giver is encouraged to add useful complementary connections across rounds instead of repeating a trait that no longer separates survivors. It compares plausible interpretations across these dimensions and checks whether a clue could mislead the human about the target, including unintended patterns across several clues. The giver considers both directions for each available card; neither sign is imposed by a quota. A clear direct Similar connection breaks an otherwise equal tie. Brief public explanations remain sealed, rather than exposing the candidate deliberation. [Clue-direction notes](AI_CLUES.md) record the investigation and live prompt comparisons.

## API spending

Each AI game displays its running USD estimate during play and on the result screen. After a response, a rough five-round guide extrapolates the costs observed in that game; it is not a quote or a spending cap. **Settings → API usage** shows the local total, game count, request count, token breakdown, costs by model and all recorded games, including unfinished games. Human-only games appear with zero AI requests. The history persists independently of game saves and provider keys.

OpenRouter's returned cost takes priority. OpenAI and Anthropic estimates use the response's token counts, including image input, output/reasoning and caching, with saved model rates. Verified defaults cover GPT-6 Luna and Claude Sonnet 4.6. **Model pricing for estimates** lets you supply USD-per-million rates for another model; loading OpenRouter's model list also loads catalog prices. Rates are captured for each request so later changes do not rewrite previous estimates.

Every response is accounted for before its move is parsed, so paid correction attempts and rejected moves are included. Unavailable usage, unknown model rates and interrupted/cancelled requests remain visibly unknown; **≥** identifies a total covering only known charges. Earlier games cannot be backfilled. This panel tracks play on this browser and origin, not the whole provider account. Special pricing and taxes may differ from the estimate. [Accounting details and sources](API_USAGE.md).

## Reconnection and saving

AI and one-screen games are saved after each move. Both live seats save checkpoints and reconnect to the same room after reload; the giver retains authoritative state and the guesser retains a filtered view. Take-turn games instead persist on the server and need neither browser to stay open. An interrupted guest move can be retried after reconnecting; revisions prevent duplicate actions. A rematch keeps the current connection and deals a new secret and board.

These are cooperative games between trusted players. A local browser that runs a solo game necessarily holds the game engine's secret; the AI's actual request is filtered by role. In multiplayer, the guesser is not sent the secret until the game ends. Replay data and network input are validated before use, and user notes are rendered as text.

## Source

- `src/game.js`: rules, dealing, move validation, role projections, replay/network validation.
- `src/decks.js`: the eleven card rosters and future theme ideas.
- `src/musicians.js`: the additional musician and band roster with explicit supplemental atlas cells.
- `src/expansion.js`: the 63 appended subjects, date captions and biographies.
- `src/artwork.js`: subject-based redraw mappings shared across overlapping themes.
- `src/context.js`: shared dates and descriptions for all card subjects.
- `src/art.js`: full-bleed Canvas artwork, captions, atlas loading and labelled AI observation images.
- `src/app.js`: accessible native controls, game flow, room games, local saving, replay and settings.
- `src/ai.js`: image requests and provider-specific authentication, models and reasoning controls.
- `src/storage.js`, `src/sound.js`: local persistence, audio controls and synthesized arcade sounds.
- `src/usage.js`: local request ledger, provider usage normalization, captured pricing and spending summaries.
- `src/music.js`, `src/outcome.js`: eleven original scores, WebAudio playback and finite result animations.
- `assets/PROMPTS.md`: the complete image-generation prompts and provenance.
- `assets/EXPANSION_PROMPTS.md`: expansion/redesign prompts and accepted or rejected dispositions.
- `CARD_AUDIT.md`: original individual findings, with the [90-card expansion review](FORTY_CARD_EXPANSION.md) covering the new cards (541 active cards and 27 archived region/province cards overall).

No tests or test suites are included, as requested. Verification is performed directly in the browser. [Play notes](PLAY_NOTES.md) record the live GPT-6 Luna games, prompt refinements, interface checks and remaining limitations.

## Credits and documentation

Independent game inspired by [Similo](https://www.gigamic.com/blog/post/tout-sur-la-gamme-similo), designed by Hjalmar Hach, Pierluca Zizzi and Martino Chiacchiera. All illustrations here are newly generated, stylized art; no commercial Similo or Balatro artwork is used. The built-in image tool does not expose a model selector, so the requested image model version cannot be verified. The full prompt set is saved with the assets.

Provider documentation: [GPT-6 Luna](https://developers.openai.com/api/docs/models/gpt-6-luna), [OpenAI images](https://developers.openai.com/api/docs/guides/images-vision), [OpenRouter reasoning](https://openrouter.ai/docs/guides/best-practices/reasoning-tokens), [Anthropic effort](https://platform.claude.com/docs/en/build-with-claude/effort). Connection documentation: [WebRTC peer connections](https://webrtc.org/getting-started/peer-connections).

## Collection integration

AI provider/model preferences, reasoning effort, output budget, opt-in remembered keys, custom pricing and the usage ledger are shared with Flip it and Midnight Table through `shared/ai/`. Existing settings, saved games and usage history from the previous name remain available; the game migrates its local preferences and session to `cluance-v1:` storage. Card size, music, sound and game setup remain Cluance preferences. Appearance is shared separately with the other card games. The latest giver/guesser decision schema, role-filtered images, sealed intentions and spending controls are preserved. Publish `shared/` alongside the game folders.


## Renaming compatibility

New exports use the `cluance-replay` format and `cluance-…json` filenames. Previous `similo-arcade-replay` files still import, and their optional sealed-note fields remain compatible. The former browser storage keys are retained as migration inputs; shared settings also clear remembered keys from both namespaces when remembering is disabled or keys are forgotten. The game is hosted only at `cluance/`; the former `similo/` redirect has been removed. Credits continue to identify the original game that inspired Cluance.

## Playing with a friend

The collection has one room and conversation for all games. Cluance's **Invite a friend** and **Join a friend** controls open the Play together window; requests, turns and messages raise notifications. See [playing with a friend](../docs/FRIEND_SESSIONS.md).
