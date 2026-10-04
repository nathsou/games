# Play multiple games with one friend connection

Invite a friend from Flip It or Cluance, or open **Play with a friend** from the collection. Invitations now open the shared `together/` page. The game occupies the page beneath a small friend bar; either player can choose **Next game**, and their friend accepts or declines.

An accepted switch ends the current table and starts a fresh game for both players. The existing WebRTC connection, data channel and relay credentials remain open. Switching does not create another Cloudflare room or require another invitation. Choosing the current game starts an agreed fresh table. Each game's normal rematch and Cluance's agreed role swap remain available.

Leaving a table pauses it while keeping the friend connection. Choose the next game to continue together. **Disconnect**, leaving the shared page, or reloading it closes the connection. A fresh invitation reconnects using the games' existing saved-game recovery; game switching itself does not promise recovery after a browser/network interruption. Both players should keep the shared page open. The existing managed TURN credential lifetime still applies; switching does not refresh credentials.

Only Cluance and Flip It currently support this session. Older invitation links without the `together=1` fragment marker retain their original single-game flow. New links work when opened, pasted or scanned, with automatic Cloudflare signaling or manual invite/reply pairing. Both players need the updated site for a shared session.

## Implementation

`shared/friend-session.js` owns one physical `PeerLink` in the outer page. The initial game's wire protocol is fixed for the life of that connection. Each embedded game receives a small `GamePeer` adapter with the existing invite, join, send and status interface. Closing that adapter after connection detaches the game rather than closing WebRTC.

Game packets are wrapped with their game ID and a fresh generation for each accepted switch. The receiver discards packets from another game or an earlier generation before calling the game session. A switch waits for both game adapters to load before starting their handshake. The original inviter coordinates switch commits and sends public setup options; Cluance's giver/guesser authority can still swap independently. Private cards, notes, gameplay and switch requests stay on the encrypted peer data channel; Cloudflare continues to handle only connection metadata.

`shared/friend-context.js` is the small bridge used by each game, and `shared/game-entry.js` routes marked invitations. The game's `registerFriendGame` adapter supplies three operations: public `setup`, initial `invite`, and `start` with host/guest identity and public metadata. Add another supported game to `FRIEND_GAMES`, provide this adapter, and use the shared transport and entry point. No packages or additional Cloudflare bindings are required.

The asset build includes `together/`. Same-origin embedding uses `X-Frame-Options: SAMEORIGIN`; cross-origin framing remains blocked.

## Verification

The existing optional `npm run test:cloudflare:ui` browser audit now checks sessions beginning in either game, requests from both players, decline/cancellation, repeated switches and fresh deals, private views, Cluance role swaps, old-generation rejection, and saved-game reconnection. It asserts that both peers retain their original RTC object and that switching creates no new invitation rooms. It also checks native offer/answer exchange, manual dialog recovery and 1280/390/320-pixel layouts.

Run the audit against Wrangler (`npm run build`, `npm run dev`) using the existing optional Playwright tooling documented in [Cloudflare setup](CLOUDFLARE.md). Gameplay uses a browser test RTC substitute with real Worker/WebSocket signaling. Native cross-network connectivity still needs the deployed site and a working direct/managed TURN route; the managed test environment supplies no usable native ICE candidates. No test dependencies have been added.
