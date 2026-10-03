# games

Small browser games in vanilla JavaScript. The index page lists them as cards and is deployed to GitHub Pages from `main` (see `.github/workflows/pages.yml`).

| Game | Folder |
| --- | --- |
| **Flip it**: configurable two-player card duel, WebRTC, local play and team play, no dependencies | [`flip-it/`](flip-it/) |
| **Spacegolf**: golf in space, WebGL2, no dependencies | [`spacegolf/`](spacegolf/) |

To add a game: put it in its own folder with an `index.html`, add a card to the root `index.html`, and copy its files in the workflow's "Assemble site" step.
