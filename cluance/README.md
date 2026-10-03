# Cluance

A cooperative visual deduction game with original retro pixel art. Play with a friend through link-based WebRTC pairing, or with a vision-language-model partner in either role. Built with native browser APIs and Canvas 2D. **No runtime or development packages, CDNs, frameworks, fonts, build step, or backend.**

## Run

From this directory:

```sh
node tools/serve.mjs
```

Open <http://127.0.0.1:4173>. Optionally set `PORT` to use another port. The preview server uses only Node's standard library. Any static HTTP server also works; ES modules require serving over HTTP rather than opening `index.html` as a local file.

## GitHub Pages

Publish `cluance/` together with the repository's `shared/` directory. The Pages workflow assembles both alongside the other games when changes reach `main`. The game URL is `https://nathsou.github.io/games/cluance/`; relative imports also support another static host with the same directory layout. The local preview server serves the shared files automatically.

There is no hosted room registry. AI mode makes browser requests directly to the user's selected provider. Multiplayer uses browser-to-browser WebRTC and, by default, a public STUN service for route discovery. No TURN service is provided; optional relay credentials and STUN addresses can be supplied in the shared invitation controls.

## Play

- **Play with a friend:** the creator is the clue giver. Create and send an invitation link. The friend opens it, receives a reply link automatically, and sends it back. The creator pastes the reply; both browsers open the shared table. Keep both tabs open. This exchange contains connection metadata, not the secret, hand, notes, or API keys.
- **Guess the AI's card:** the AI knows the secret and chooses one clue card and its direction each round.
- **Give clues to AI:** you know the secret and play clues; the AI chooses cards to eliminate.
- **Play on one screen:** pass the device between roles using a privacy curtain. No provider key is required.

The board has twelve illustrated people or places. The clue giver starts with five cards and plays one as **Similar** (upright) or **Different** (sideways). The guesser eliminates **1, 2, 3, 4, 1** cards across five rounds. Removing the secret loses immediately; leaving it alone wins. Clues accumulate and remain relevant.

**Classic hand:** draw one replacement after each clue. **Fixed five:** no replacements; use the initial five cards in a considered order.

Eleven decks with **330 active illustrated cards: 30 in every theme**, matching the publisher's [30-card Similo deck size](https://horribleguild.com/eu/product/similo-history/). Scientists includes Charles Babbage, Philosophers includes Jean-Paul Sartre, and Writers includes Albert Camus. Every existing and new card has an [individual audit record](CARD_AUDIT.md); inconsistent artwork was redrawn from scratch with imagegen.

1. French History
2. Global History
3. Greek Mythology
4. Scientists
5. Philosophers
6. Writers
7. Singers
8. Actors
9. Cities
10. Countries
11. French Regions

Cities include Paris, Rome, London, Berlin, Tokyo and New York City, with 24 more cities worldwide. French Regions contains the complete division as it stood on 31 December 2015: [22 metropolitan regions](https://www.insee.fr/fr/statistiques/1906658), including Corsica, and five overseas regions. Three additional cards depict **historical provinces: Anjou, Touraine and Provence**, explicitly labelled in their captions and descriptions; they are not extra administrative regions of 2015. Every card has one original illustration, dates and public context. Centre-Val de Loire uses its [name adopted in January 2015](https://www.legifrance.gouv.fr/loda/article_lc/LEGIARTI000030110734). New deals exclude the merged post-2016 regions. Old region IDs and their artwork are preserved only for compatible saved games and replays.

Every card displays a date caption and has a short description available in card inspection. People have lifespans or labelled birth years; places have labelled landmarks or milestones. Approximate and traditional dates are marked, and mythological figures are identified as myths. The [card context notes](CARD_CONTEXT.md) explain these conventions and link selected references.

Choose board and clue decks independently, including people/place combinations. When themes overlap, clue cards depicting the same subject as a board card are excluded. The opening screen also offers future theme ideas and a collection browser. All decks use smaller WebP delivery images; the original generated PNGs are retained with their prompts.

Select cards with a mouse, touch, or keyboard; activate focused buttons with Enter or Space. Click **Details** below a board or hand card to see its artwork, dates and short biography without changing your selection. Click a clue to inspect it. Right-click, double-click, and the **I** shortcut remain available. The final round offers a larger side-by-side comparison of the last two candidates. The AI observation includes a matching close-up comparison. Choose **Compact**, **Comfortable** or **Large** from the table’s card-size control, or in **Settings**; the board rearranges to fit the screen. Settings also offers **Light**, **Dark** and **System** appearance. System follows your operating system, including changes during play. These preferences are saved locally. Standard browser zoom works. Reduced-motion preferences disable animation.

Each board theme has an [original WebAudio composition](MUSIC.md), with music starting after a user gesture and pausing in hidden tabs. The top music button pauses only background music, leaving the sound-effects setting unchanged; Settings offers independent music and effect switches and a music-volume slider. Wins and losses open an explicit result dialog with the revealed card, a brief celebration or falling-card effect, and a corresponding musical cue before opening the sealed interpretations.

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

AI and one-screen games are saved after each move. The clue giver also saves multiplayer state and can resume it with a fresh invitation after a reload. The guest's browser receives only public state and must re-pair with the giver. An interrupted guest move can be retried after reconnecting; revisions prevent duplicate actions. A rematch keeps the current connection and deals a new secret and board.

These are cooperative games between trusted players. A local browser that runs a solo game necessarily holds the game engine's secret; the AI's actual request is filtered by role. In multiplayer, the guest is not sent the secret until the game ends. Replay data and network input are validated before use, and user notes are rendered as text.

## Source

- `src/game.js`: rules, dealing, move validation, role projections, replay/network validation.
- `src/decks.js`: the eleven card rosters and future theme ideas.
- `src/expansion.js`: the 63 appended subjects, date captions and biographies.
- `src/artwork.js`: subject-based redraw mappings shared across overlapping themes.
- `src/context.js`: shared dates and descriptions for all card subjects.
- `src/art.js`: Canvas card rendering, atlas loading, AI observation images and animated felt.
- `src/app.js`: accessible native controls, game flow, pairing, local saving, replay and settings.
- `src/peer.js`: Cluance configuration for the shared invitation tokens and WebRTC transport.
- `src/ai.js`: image requests and provider-specific authentication, models and reasoning controls.
- `src/storage.js`, `src/sound.js`: local persistence, audio controls and synthesized arcade sounds.
- `src/usage.js`: local request ledger, provider usage normalization, captured pricing and spending summaries.
- `src/music.js`, `src/outcome.js`: eleven original scores, WebAudio playback and finite result animations.
- `assets/PROMPTS.md`: the complete image-generation prompts and provenance.
- `assets/EXPANSION_PROMPTS.md`: expansion/redesign prompts and accepted or rejected dispositions.
- `CARD_AUDIT.md`: individual findings for all 330 active cards and 24 archived region cards.

No tests or test suites are included, as requested. Verification is performed directly in the browser. [Play notes](PLAY_NOTES.md) record the live GPT-6 Luna games, prompt refinements, interface checks and remaining limitations.

## Credits and documentation

Independent game inspired by [Similo](https://www.gigamic.com/blog/post/tout-sur-la-gamme-similo), designed by Hjalmar Hach, Pierluca Zizzi and Martino Chiacchiera. All illustrations here are newly generated, stylized art; no commercial Similo or Balatro artwork is used. The built-in image tool does not expose a model selector, so the requested image model version cannot be verified. The full prompt set is saved with the assets.

Provider documentation: [GPT-6 Luna](https://developers.openai.com/api/docs/models/gpt-6-luna), [OpenAI images](https://developers.openai.com/api/docs/guides/images-vision), [OpenRouter reasoning](https://openrouter.ai/docs/guides/best-practices/reasoning-tokens), [Anthropic effort](https://platform.claude.com/docs/en/build-with-claude/effort). Connection documentation: [WebRTC peer connections](https://webrtc.org/getting-started/peer-connections).

## Collection integration

AI provider/model preferences, reasoning effort, output budget, opt-in remembered keys, custom pricing and the usage ledger are shared with Flip it and Midnight Table through `shared/ai/`. Existing settings, saved games and usage history from the previous name remain available; the game migrates its local preferences and session to `cluance-v1:` storage. Card size, music, sound and game setup remain Cluance preferences. Appearance is shared separately with the other card games. The latest giver/guesser decision schema, role-filtered images, sealed intentions and spending controls are preserved. Publish `shared/` alongside the game folders.


## Renaming compatibility

New exports use the `cluance-replay` format and `cluance-…json` filenames. Previous `similo-arcade-replay` files still import, and their optional sealed-note fields remain compatible. The former browser storage keys are retained as migration inputs; shared settings also clear remembered keys from both namespaces when remembering is disabled or keys are forgotten. The game is hosted only at `cluance/`; the former `similo/` redirect has been removed. Credits continue to identify the original game that inspired Cluance.

## Shared invitations

Flip it and Cluance use the same three-step invitation controls and WebRTC transport. Creating an invitation starts automatically; opening or pasting an invitation prepares a reply automatically. Both links support copy, native share and QR codes. Paste the reply into the host tab to connect automatically, or open it in another tab of the same browser to send it to the original host. Connection settings include optional TURN credentials (kept in memory) and STUN configuration. Make a fresh invite or remake a reply to apply changed settings. Replies are bound to their original invitation; another table’s reply is rejected. Previous SIM invitation codes must be regenerated as new CL links. The saved host table still resumes with a fresh invitation.
