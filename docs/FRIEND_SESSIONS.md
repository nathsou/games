# Friend rooms, multiplayer and shared screens

The collection, Cluance and Flip It use the same friend panel. **Invite a friend** in that panel creates a game-independent room. Share its short link and keep the page open. The two supported multiplayer games also retain their own invite controls and manual pairing fallback.

Once connected, choose **Next game** to start Cluance or Flip It together. Either friend can request a game; the other accepts or declines. An accepted switch ends the current table and starts a fresh game without another invitation, signaling room or friend connection. **Games** returns both players to the collection after the same agreement. Native rematches and Cluance's agreed role swap remain available.

## Messages and header visibility

**Chat** opens a small message and reaction panel. Its history, unread count and draft survive game switches and shared-screen mode. The original inviter orders messages so simultaneous sends produce the same history on both screens. Text is limited to 280 characters, reactions use a fixed list, and sending is throttled. The last 60 entries remain in memory; chat is not stored in Cloudflare or browser storage. A fresh connection clears the previous room's history. Disconnection disables sending while leaving the current history readable.

The header auto-hides after three idle seconds, including on the collection page. Move to the top edge or use the **Friends** button to reveal it; that button also shows unread messages. The header stays open for invitation/confirmation dialogs and focused header controls. Open **⚙ → Auto-hide friend header** to keep it visible. This preference is saved in the current browser.

## Virtual cursors: one shared game

**Cursors** is a separate mode from native multiplayer. Either friend can request it. The original room creator shares the current Games tab using the browser's tab-sharing picker, and the other friend accepts shared play. A desktop browser with tab capture is required to host; a friend can view and control from a smaller screen.

Only the host runs the shared game. The friend receives a live video of its game area and sends pointer, drag, wheel and keyboard input back to that document. Both see the same random deals, physics, animations and game state, including visible private cards and notes. This also works with Spacegolf, Midnight Table, Nonocube and Pawn Quest. Both friends can navigate the collection or choose another game using the same room. Each sees the other's cursor. A typing field beneath the shared screen lets touch devices enter text into the selected game field.

Sharing an existing local game keeps it running. Switching from a native two-player table ends that table and returns the host's game to its start screen before sharing. Normal private-view multiplayer and shared-screen play are distinct modes. **Stop** or stopping capture in the browser ends shared play and returns both players to the collection, keeping chat and the friend connection open. The next native game can start without another invitation.

Choose this Games tab in the share picker. Windows and entire-screen capture are rejected when the browser reports the surface; browsers with Capture Handle also verify the selected tab. Browser permissions still apply, and a browser without tab capture cannot host this mode. The mode shares video without audio. Remote input is confined to the game iframe: it cannot operate the friend panel, browser chrome, permission dialogs, clipboard, password fields or file pickers. Use the host's own controls for those actions. Browser-native interactions that depend on trusted input, such as audio unlock and some native pickers, need the host. This is a collection-wide game-sharing feature, not remote control of other websites or the operating system.

## Lifetime and implementation

Leaving a native table pauses it while retaining the room. **Disconnect**, leaving the outer page, reloading it or a network interruption closes the friend connection. A fresh invitation uses the games' existing saved-game recovery. Native game switching and shared screens do not promise recovery of unsaved state after a browser/network interruption. Managed TURN credential lifetimes still apply; switching does not refresh them.

`shared/friend-session.js` owns one physical `PeerLink` in the outer page. Its initial wire protocol stays fixed. Embedded multiplayer games receive a `GamePeer` adapter with their existing invite, join, send and status interface. Closing an adapter detaches the game rather than closing WebRTC. Gameplay envelopes contain a game ID and generation; stale packets cannot reach a replacement game. Switches wait for both adapters to load. The original inviter coordinates commits and public setup, while Cluance's clue-giving authority can swap independently.

Game-independent rooms use the `friends` signaling namespace with protocol 1 and no game metadata. Existing game invites continue using their game protocols; older unmarked links keep their single-game flow. `shared/friend-context.js` bridges native adapters, and `shared/game-entry.js` opens the shared panel for ordinary Cluance/Flip It visits and marked invitations. `shared/friend-panel.js` supplies the panel markup once for the index and `together/`; `collection/` contains the embedded collection content.

`shared/shared-screen.js` manages capture consent and a separate media peer connection. Its SDP and ICE travel over the existing authenticated friend data channel; it uses the room's existing ICE configuration and creates no extra signaling room. The guest's game iframe is unloaded during shared play. Controls carry a source-page generation: late input from a replaced page is discarded, and the guest waits for the new document to load before sending controls. `shared/screen-input.js` validates and rate-limits controls; `shared/shared-screen-view.js` handles cropped video, coordinate scaling and cursors. Shared play does not serialize DOM, execute remote code or try to replay random state independently on two clients.

Gameplay, chat, cursor data and shared-screen negotiation stay on the encrypted peer connection; video uses encrypted WebRTC media. Cloudflare handles initial connection metadata. No new packages, Worker bindings, secrets or deployment settings are required. Deploy the updated Worker and assets together. The asset build includes the collection and shared runtime; same-origin embedding remains allowed while cross-origin framing is blocked.

## Verification

Run the existing optional `npm run test:cloudflare:ui` browser audit against Wrangler (`npm run build`, `npm run dev`) using the optional Playwright setup in [Cloudflare setup](CLOUDFLARE.md). It checks:

- Collection room creation, reopening the invite, host/guest permissions, shared-mode consent/decline, capture cleanup, room reuse and returning to native multiplayer.
- Desktop-to-phone coordinate scaling, remote collection navigation, canvas drag/wheel/keyboard events, text entry, both cursors and navigation to every game.
- Chat ordering, reactions, literal HTML text, unread badges and preservation of history/drafts across native switches; configurable header hiding and reveal controls.
- Sessions beginning in both native games, requests from both players, decline/cancellation, repeated switches, private views, role swaps, stale-generation rejection, saved-game reconnect and explicit disconnection.
- Real native offer/answer exchange, manual dialog recovery and 1280/390/320-pixel layouts. The existing backend permission checks also exercise the independent `friends` namespace.

Gameplay and shared-screen lifecycle checks use browser-test-only RTC/capture substitutes with real Worker/WebSocket signaling. They do not establish actual native video delivery or cross-network connectivity. This managed environment supplies no usable native ICE candidates; those checks still require two browsers on the deployed site with a working direct or TURN route. No test dependencies have been added.
