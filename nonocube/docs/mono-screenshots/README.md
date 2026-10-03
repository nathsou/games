# Mono redesign captures

These PNGs were captured from the running Nonocube application with Chromium and the real WebGL renderer on 2026-10-03. They are implementation screenshots, not images from the supplied design prototype.

Desktop captures use 1160×700; phone captures use a 390×800 touch viewport. The browser checks also cover 320×568. Each run begins with a fresh browser store, skips the first-launch welcome dialog, and enables reduced motion. Progress, clues, solver status, save records and solved sculptures come from actual game state. The solved capture finishes a real PlaySession; the editor capture builds and validates a five-cube model.

To regenerate, start `npm run dev`, then run `npm run test:ui -- --screenshots` from `nonocube/`. Set `CHROMIUM_PATH` if using an installed browser. See the main README for details.

| Capture | Screen |
| --- | --- |
| [01](01-home-light-desktop.png) | Home |
| [02](02-galleries-light-desktop.png) | Galleries |
| [03](03-gallery-room-light-desktop.png) | Gallery room |
| [04](04-play-light-desktop.png) | Play |
| [05](05-tutorial-light-desktop.png) | Tutorial |
| [06](06-solved-light-desktop.png) | Solved plaque |
| [07](07-settings-light-desktop.png) | Settings |
| [08](08-editor-light-desktop.png) | Editor |
| [09](09-play-dark-desktop.png) | Dark play |
| [10](10-home-light-phone.png) | Phone home |
| [11](11-play-light-phone.png) | Phone play |
| [12](12-gallery-room-light-phone.png) | Phone gallery |
| [13](13-play-progress-light-desktop.png) | Broken cube with a persistent ghost clue |
