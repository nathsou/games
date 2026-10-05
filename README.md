# games

Small browser games in vanilla JavaScript. The index page lists them as cards. Cloudflare Workers hosts the collection from `main`; [Cloudflare setup](docs/CLOUDFLARE.md) covers the account, deployment and friend rooms.

| Game | Folder |
| --- | --- |
| **Flip it**: configurable two-to-five-player card game, play a friend, local play and team play, no dependencies | [`flip-it/`](flip-it/) |
| **Midnight Table**: three card games, solo, local and friend duel or co-op, no dependencies | [midnight/](midnight/) |
| **Cluance**: cooperative deduction, twelve decks, vision AI or a friend | [cluance/](cluance/) |
| **Spacegolf**: golf in space, WebGL2, no dependencies | [`spacegolf/`](spacegolf/) |
| **Pawn Quest**: learn chess from scratch with puzzles, boss battles and an algorithmic coach, no dependencies | [`pawn-quest/`](pawn-quest/) |
| **Nonocube**: 3D nonograms, WebGL2, TypeScript + Vite (built in CI) | [`nonocube/`](nonocube/) |

To add a game: put it in its own folder with an `index.html`, add a card to the root `index.html`, and include its runtime files in `tools/build-site.mjs`.

Invite a friend once from the **Play together** window and keep one room across every game: [how it works](docs/FRIEND_SESSIONS.md). Flip It, Cluance and Midnight Table run on the room's server, so they play live when you're both there and carry on when one of you leaves. Game requests, turns and messages raise notifications, and any other game can be shared with cursors.

All card games share AI settings and Light/Dark/System appearance. [AI implementation and verification](shared/ai/README.md).

Repository history keeps source, tests, workflows, documentation, and runtime assets. Cluance ships WebP artwork; redundant PNG originals, unused card prototypes, design mockups, and generated screenshots are excluded. Generation prompts and capture instructions remain available in each game's documentation.
