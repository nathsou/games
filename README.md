# games

Small browser games in vanilla JavaScript. The index page lists them as cards and is deployed to GitHub Pages from `main` (see `.github/workflows/pages.yml`).

| Game | Folder |
| --- | --- |
| **Flip it**: configurable two-to-five-player card game, WebRTC, local play and team play, no dependencies | [`flip-it/`](flip-it/) |
| **Midnight Table**: three card games, solo/local/WebRTC duel and co-op, no dependencies | [midnight/](midnight/) |
| **Cluance**: cooperative deduction, eleven decks, vision AI and WebRTC | [cluance/](cluance/) |
| **Spacegolf**: golf in space, WebGL2, no dependencies | [`spacegolf/`](spacegolf/) |
| **Nonocube**: 3D nonograms, WebGL2, TypeScript + Vite (built in CI) | [`nonocube/`](nonocube/) |

To add a game: put it in its own folder with an `index.html`, add a card to the root `index.html`, and copy its files in the workflow's "Assemble site" step.

All card games share AI settings and Light/Dark/System appearance. [AI implementation and verification](shared/ai/README.md).
