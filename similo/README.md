# Similo Arcade

A cooperative visual deduction game with original retro pixel art. Play with a friend through manual WebRTC pairing, or with a vision-language-model partner in either role. Built with native browser APIs and Canvas 2D. **No runtime or development packages, CDNs, frameworks, fonts, build step, or backend.**

## Run

From this directory:

```sh
node tools/serve.mjs
```

Open <http://127.0.0.1:4173>. Optionally set `PORT` to use another port. The preview server uses only Node's standard library. Any static HTTP server also works; ES modules require serving over HTTP rather than opening `index.html` as a local file.

## GitHub Pages

The `similo/` directory is already the deployable game. In repository Settings → Pages, choose **Deploy from a branch**, `main`, and `/ (root)`. Once this PR is merged and Pages publishes the branch, the game is available at `https://nathsou.github.io/games/similo/`. All file paths are relative, so deployment under a subdirectory works without configuration.

There is no hosted room registry. AI mode makes browser requests directly to the user's selected provider. Multiplayer uses browser-to-browser WebRTC and, by default, a public STUN service for route discovery. No TURN relay is configured, so some restrictive networks cannot connect; the STUN server can be changed or disabled in Settings.

## Play

- **Play with a friend:** the creator is the clue giver. Create and send an invitation link. The friend opens it, creates a reply code, and sends it back. The creator pastes the reply; both browsers open the shared table. Keep both tabs open. This exchange contains connection metadata, not the secret, hand, notes, or API keys.
- **Guess the AI's character:** the AI knows the secret and chooses one clue card and its direction each round.
- **Give clues to AI:** you know the secret and play clues; the AI chooses characters to eliminate.
- **Play on one screen:** pass the device between roles using a privacy curtain. No provider key is required.

The board has twelve characters. The clue giver starts with five cards and plays one as **Similar** (upright) or **Different** (sideways). The guesser eliminates **1, 2, 3, 4, 1** characters across five rounds. Removing the secret loses immediately; leaving it alone wins. Clues accumulate and remain relevant.

**Classic hand:** draw one replacement after each clue. **Fixed five:** no replacements; use the initial five cards in a considered order.

Six decks, each with 24 illustrated cards:

1. French History
2. Global History
3. Greek Mythology
4. Scientists
5. Philosophers
6. Writers

Choose board and clue decks independently. When themes overlap, clue cards depicting someone on the board are excluded. The opening screen also offers future theme ideas and a collection browser.

Select cards with a mouse, touch, or keyboard; activate focused buttons with Enter or Space. Right-click, double-click, or focus a card and press **I** to inspect it. The final round offers a larger side-by-side comparison of the last two candidates. The AI observation includes a matching close-up comparison. Standard browser zoom works. Reduced-motion preferences disable animation.

## AI settings

Open **AI Settings**, choose OpenRouter, OpenAI, or Anthropic, and supply a personal key. Keys are stored in this browser's local storage when **Remember keys** is selected; otherwise they remain in memory for the visit. **Forget all saved keys** removes them. Browser storage is not a secret vault and is shared by pages on the same origin. Keys are sent only to the corresponding fixed provider endpoint and never included in multiplayer messages, saved games, or replay exports. Environment files are ignored by Git.

Choose an image-capable model by exact model ID or load the provider's model list. OpenRouter's list is filtered to image-capable models; OpenAI and Anthropic model lists do not establish all modality or effort capabilities, so select a known vision model. The initial OpenAI model is `gpt-6-luna`; OpenRouter uses `openai/gpt-6-luna`. Models and availability depend on your provider account.

Reasoning effort is configurable, including a **Provider default** option that omits the parameter. Support varies by model; unsupported choices produce a visible error rather than being silently altered. A separate response-token budget accommodates reasoning tokens. Requests can be cancelled or retried. Invalid model moves get one correction attempt without advancing the game. Provider failures preserve the turn and show a retry/settings action.

Every AI decision gets a freshly rendered image of its permitted board, public clues, and, for the giver, its hand and target. A matching observation supplies IDs, names, elimination status and legal move counts. The model also gets its own previously recorded explanations as a memory of its earlier associations. It never receives its partner's sealed explanations. The guesser receives no target, private hand, or draw pile. There is no persistent provider conversation that could accidentally leak a previous role's private information. The OpenAI Responses adapter sets `store: false`.

The game requests a brief player-facing explanation with the decision. This is a contemporaneous explanation of the association, not an internal reasoning transcript. Human notes are optional. Both are sealed during play and shown round by round at the end. Save a replay as JSON and reopen it from the opening screen; replays contain no credentials.

## Reconnection and saving

AI and one-screen games are saved after each move. The clue giver also saves multiplayer state and can resume it with a fresh invitation after a reload. The guest's browser receives only public state and must re-pair with the giver. An interrupted guest move can be retried after reconnecting; revisions prevent duplicate actions. A rematch keeps the current connection and deals a new secret and board.

These are cooperative games between trusted players. A local browser that runs a solo game necessarily holds the game engine's secret; the AI's actual request is filtered by role. In multiplayer, the guest is not sent the secret until the game ends. Replay data and network input are validated before use, and user notes are rendered as text.

## Source

- `src/game.js`: rules, dealing, move validation, role projections, replay/network validation.
- `src/decks.js`: the six card rosters and future theme ideas.
- `src/art.js`: Canvas card rendering, atlas loading, AI observation images and animated felt.
- `src/app.js`: accessible native controls, game flow, pairing, local saving, replay and settings.
- `src/peer.js`: compressed invitation/reply tokens and reliable ordered WebRTC messages.
- `src/ai.js`: image requests and provider-specific authentication, models and reasoning controls.
- `src/storage.js`, `src/sound.js`: local persistence and synthesized arcade sounds.
- `assets/PROMPTS.md`: the complete image-generation prompts and provenance.

No tests or test suites are included, as requested. Verification is performed directly in the browser. [Play notes](PLAY_NOTES.md) record the live GPT-6 Luna games, prompt refinements, interface checks and remaining limitations.

## Credits and documentation

Independent game inspired by [Similo](https://www.gigamic.com/blog/post/tout-sur-la-gamme-similo), designed by Hjalmar Hach, Pierluca Zizzi and Martino Chiacchiera. All portrait illustrations here are newly generated, stylized art; no commercial Similo or Balatro artwork is used. The built-in image tool does not expose a model selector, so the requested image model version cannot be verified. The full prompt set is saved with the assets.

Provider documentation: [GPT-6 Luna](https://developers.openai.com/api/docs/models/gpt-6-luna), [OpenAI images](https://developers.openai.com/api/docs/guides/images-vision), [OpenRouter reasoning](https://openrouter.ai/docs/guides/best-practices/reasoning-tokens), [Anthropic effort](https://platform.claude.com/docs/en/build-with-claude/effort). Connection documentation: [WebRTC peer connections](https://webrtc.org/getting-started/peer-connections).
