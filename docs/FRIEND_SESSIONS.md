# Friend rooms, multiplayer and shared state

The collection, Cluance and Flip It use the same friend panel. **Invite a friend** in that panel creates a game-independent room. Share its short link and keep the page open. The two supported multiplayer games also retain their own invite controls and manual pairing fallback.

Once connected, choose **Next game** to start Cluance or Flip It together. Either friend can request a game; the other accepts or declines. An accepted switch ends the current table and starts a fresh game without another invitation, signaling room or friend connection. **Games** returns both players to the collection after the same agreement. Native rematches and Cluance's agreed role swap remain available.

## Messages and header visibility

**Chat** opens a small message and reaction panel. Its history, unread count and draft survive game switches and shared play. The original inviter orders messages so simultaneous sends produce the same history on both screens. Text is limited to 280 characters, reactions use a fixed list, and sending is throttled. The last 60 entries remain in memory; chat is not stored in Cloudflare or browser storage. A fresh connection clears the previous room's history. Disconnection disables sending while leaving the current history readable.

The header auto-hides after three idle seconds, including on the collection page. Move to the top edge or use the **Friends** button to reveal it; that button also shows unread messages. The header stays open for invitation/confirmation dialogs and focused header controls. Open **⚙ → Auto-hide friend header** to keep it visible. This preference is saved in the current browser.

## Virtual cursors: one shared game

**Cursors** is a separate mode from native multiplayer. Either friend can request it, and both agree before starting. The original room creator runs the authoritative game; both browsers render its shared view locally. No tab capture, screen recording, video stream or browser sharing permission is used. Either a desktop or phone can host, provided its browser can run the selected game.

Both friends can click, drag, scroll and use the keyboard. Their actions run through the host's existing game rules, AI and physics, so random deals and simulations have one authority. UI view state and the board/camera data needed to render that view travel over the existing friend data channel. The guest does not independently simulate the game, run AI or save the host's progress in its browser. In this mode both see the host's view, including visible cards and notes; native Cluance/Flip It retain their separate private views.

The mode works in the collection, Flip It, Cluance, Spacegolf, Midnight Table, Nonocube and Pawn Quest. Both friends can navigate or choose another game without reconnecting, and each sees the other's cursor. The guest's local game frame fits the host's viewport, preserving control coordinates on different screen sizes. A typing field beneath the game lets touch devices enter text into the selected game field.

Sharing an existing local game keeps it running. Starting from a native Cluance/Flip It table ends that table and returns the host's game to its start screen. **Stop** returns both friends to the collection while retaining chat and the friend connection. Another native game can then start without a new invitation.

Remote controls target only the game iframe. Passwords, credential/invitation fields, file inputs, browser chrome, permission dialogs and the friend panel are excluded. The host must perform browser actions such as clipboard access, audio unlock and native pickers. Sensitive field values are omitted from view updates, even when a password field is revealed. This mode synchronizes the games on this site; it does not control other websites or the operating system.

## Lifetime and implementation

Leaving a native table pauses it while retaining the room. **Disconnect**, leaving the outer page, reloading it or a network interruption closes the friend connection. A fresh invitation uses the games' existing saved-game recovery. Native game switching and shared play do not promise recovery of unsaved state after a browser/network interruption. Managed TURN credential lifetimes still apply; switching does not refresh them.

`shared/friend-session.js` owns one physical `PeerLink` in the outer page. Its initial wire protocol stays fixed. Embedded multiplayer games receive a `GamePeer` adapter with their existing invite, join, send and status interface. Closing an adapter detaches the game rather than closing WebRTC. Gameplay envelopes contain a game ID and generation; stale packets cannot reach a replacement game. Switches wait for both adapters to load. The original inviter coordinates commits and public setup, while Cluance's clue-giving authority can swap independently.

Game-independent rooms use the `friends` signaling namespace with protocol 1 and no game metadata. Existing game invites continue using their game protocols; older unmarked links keep their single-game flow. `shared/friend-context.js` bridges native adapters, and `shared/game-entry.js` opens the shared panel for ordinary Cluance/Flip It visits and marked invitations. `shared/friend-panel.js` supplies the panel markup once for the index and `together/`; `collection/` contains the embedded collection content.

`shared/shared-play.js` manages consent, navigation, page generations and state delivery over the existing room channel. Each replacement page waits for the guest renderer before accepting controls. Old-generation state, cursors and inputs are discarded. State updates carry changed fields; large updates are bounded to 2 MiB and split into small ordered chunks, with backpressure so chat and controls remain responsive. Both friends need the updated shared-play protocol; an older tab is asked to reload.

`shared/view-state.js` projects UI elements and attributes into structured data, filtering executable elements, event handlers, unsafe URLs and sensitive values. The guest constructs local nodes from an allowed tag set; packets contain no executable HTML or JavaScript. Stable node IDs preserve canvas contexts. `shared/game-view.js` starts guest renderers without starting a second game engine. Cluance supplies visible card IDs for local artwork, Spacegolf supplies scene/ball state, Pawn Quest supplies chess positions, selections and declarative artwork, and Nonocube supplies visible cubes/clues, camera matrices and rendering settings. Their local renderers use the games' existing assets. Decorative effects may animate differently on each device; game actions and view state follow the host.

`shared/screen-input.js` validates and rate-limits controls; `shared/shared-play-view.js` handles coordinate scaling, consent and cursors. Gameplay, chat, state and cursor data stay on the encrypted peer connection. Cloudflare handles initial connection metadata. No new packages, Worker bindings, secrets or account settings are required. Deploy the updated assets with the existing Worker configuration.

## Verification

Run the existing optional `npm run test:cloudflare:ui` browser audit against Wrangler (`npm run build`, `npm run dev`) using the optional Playwright setup in [Cloudflare setup](CLOUDFLARE.md). It checks:

- Collection room creation, reopening the invite, host/guest permissions, shared-mode consent/decline, zero capture calls and one RTC connection, room reuse and returning to native multiplayer.
- Desktop-to-phone coordinate scaling, remote collection navigation, canvas drag/wheel/keyboard events, synchronized ball/cube/chess views, protected credentials, text entry, both cursors and navigation to every game.
- Chat ordering, reactions, literal HTML text, unread badges and preservation of history/drafts across native switches; configurable header hiding and reveal controls.
- Sessions beginning in both native games, requests from both players, decline/cancellation, repeated switches, private views, role swaps, stale-generation rejection, saved-game reconnect and explicit disconnection.
- Real native offer/answer exchange, manual dialog recovery and 1280/390/320-pixel layouts. The existing backend permission checks also exercise the independent `friends` namespace.

Shared-state and native gameplay checks use a browser-test-only RTC substitute with real Worker/WebSocket signaling. They render the actual game UI and canvas state; screen capture is replaced with a function that fails if called. These checks do not establish cross-network connectivity. This managed environment supplies no usable native ICE candidates; those checks still require two browsers on the deployed site with a working direct or TURN route. No test dependencies have been added.
