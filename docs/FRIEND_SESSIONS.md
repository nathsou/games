# Playing with a friend

Every game page has one **Play together** launcher. Before you join a room it shows a people icon. Once a friend joins, it shows their initial, an online dot (green when here, amber when their tab is in the background) and a red badge counting what needs you: your turns and unread messages. The launcher opens one movable window with three tabs: **Play**, **Games** and **Chat**.

## Invite and join

1. Enter your name once. It is saved in this browser and is what your friend sees in games, chat and notifications. Change it under **Settings** (the gear in the window).
2. Choose **Invite a friend**. The room is created immediately, with an eight-character code such as **K7QM-4XPN**, a **Share link** button (the system share sheet where available, otherwise copy), **Copy link** and a QR code.
3. Your friend enters the code under **Join a friend**, or opens the link. Lowercase, spaces and dashes are accepted.

You don't pick a game before inviting. Keep playing while you wait; a toast tells you when your friend joins.

Codes expire after 24 hours and admit one friend. Once the guest seat is claimed through either the code or the link, neither works again. Returning players use the private browser credential saved on claim. Only the room creator can issue codes; guessing is limited to 30 attempts per hour per IP, and codes are scoped to the original site. The game list page shows the same invite and join actions. Once a friend has joined, it shows quick buttons for the room games and how many turns are waiting.

## Room games

Flip It, Cluance and Midnight Table are **room games**. Their rules run on the room's server, so both players always see the same table:

- When you're both there, it plays live: moves arrive within a moment over the room connection.
- When one of you leaves, nothing pauses. Make your move and close the tab; your friend plays when they're back.
- There is no "Live" or "Take turns" mode to choose, and no reconnect button.

Start one from **Play**: choose a game, adjust its settings and **Start game**. You go straight to the table and your friend gets a request. You can keep several games going; **Games** lists them under **Your turn**, **Waiting for …** and **Finished**. **End** finishes a game for both players. Rematches create a new game and keep the old result.

- **Flip It** supports two people against each other or as a team sharing one hand, plus up to four bots or AI players. The rules bot plays in the room, paced by whichever player's page is open. AI players use the game creator's provider settings and run only while the creator has that game open; their seat's view is sent only to the creator, and only while the AI is choosing. Between rounds both people confirm.
- **Cluance**: one gives clues, the other guesses. The giver's secret and hand stay on the giver's side, and both players' reasoning stays sealed until the reveal.
- **Midnight Table**: all three games as a duel or as a team against the dealer or an AI. Simultaneous choices stay hidden until both are locked.

Inside a game, names replace "You/Friend", a note shows whether your friend is at the table, and the other player's moves play a sound.

## Notifications

| What happens | You see |
| --- | --- |
| Your friend starts a game | A request card at the top of the screen with their name, the game and its settings, and **Play now** / **Later**. It plays a chime and stays until you answer. Requests you missed while away appear when you return. |
| Your friend wants to share cursors | A request card with **Join** / **Not now**. |
| Your friend moves and it's your turn | A toast with **Open** if you're elsewhere. At the table, a chime is enough. |
| A message arrives while Chat is closed | A toast with the message and **Reply**, plus a badge. |
| Your friend joins, comes online or enters your game, or a game ends | A short toast. |

When the tab is in the background, its title flashes with the latest event and the tab icon shows a red dot. Optionally (**Settings → Notify me when this tab is in the background**), the browser shows a system notification; clicking it returns to the game. Sounds can be turned off in the same settings. These alerts need the page to be open. Notifications while the site is closed are planned as a later step.

## Shared cursors

Spacegolf, Nonocube, Pawn Quest and any other game can be shared from **Play → Share any game** while your friend is online. They get a request; when they join, your browser runs the game and theirs renders it. Both of you control it with your own cursor; game state and input travel over a direct browser connection opened only for sharing. A bar at the top shows who is sharing. **Stop sharing** or **Leave** ends it for both.

## Persistence and privacy

Each open page keeps one connection to the room's Durable Object, which hibernates while idle. The room sends each player their own presence information, chat and role-private game views. Every move is validated against the current revision, so a duplicate or stale move cannot apply twice.

The room, chat and games are kept for **90 days after the most recent visit**. At most 20 unfinished and 40 finished games are kept. Chat keeps the latest 60 messages and reactions, with 280-character text and a per-seat send limit. Your draft and read position stay in this browser.

**Settings → Leave room** removes the room from this browser only; your friend keeps their copy. Clearing site storage or changing device loses that browser's seat credential. Account-based or cross-device recovery is not provided. Keep invitation links private.

## Solo progress

Solo games keep their own checkpoints in the browser. Reloading a game resumes it, and **Continue on this device** (or **Games → On this device** in a room) lists every saved solo game. Spacegolf saves the current hole, ball physics, shots, undo history and endless run counters; Nonocube the active puzzle and progress; Pawn Quest arena and battle moves and lesson progress.

## Implementation and verification

The outer page (`together/`) owns `FriendSession` (`shared/friend-session.js`): the live room link (`shared/room-client.js`), room chat, the list of room games, the current game's `TurnClient` and, while sharing, a `PeerLink`. `together/src/app.js` renders the window, invitations, requests and notifications (`shared/together-notify.js`). Game adapters register `startAsync(client)` to play a room game and `chooseAI` to choose for the creator's AI seats. `cloudflare/turn-games.js` runs the pure rule engines of all three games on the server.

Run `npm run test:cloudflare` for live room presence, names, pushed role-private views, relays, ending games, room bots and AI seats, team play, Midnight's hidden choices, code authority, expiry, origin checks, claim races, seat recovery, stale/concurrent moves and chat. Run `npm run test:windows` for viewport bounds.

With Wrangler running (`npm run build:assets` then `npm run dev`):

- `npm run test:windows:ui` covers mouse/touch/keyboard gestures, window persistence, focus, phone/landscape layouts, theme and optional storage.
- `npm run test:cloudflare:ui` covers two separate browsers: room-code join with names, persistent request cards, pushed moves without refresh, hidden-tab alerts, closed-tab play, chat toasts/badges/drafts, room bots, postponed requests, notifications while browsing, phone layout, leaving, and shared cursors.
- `npm run test:checkpoints:ui` covers solo checkpoints.

Shared cursors use a deterministic RTC substitute in the audit; cross-network WebRTC still needs deployed relay/network verification.
