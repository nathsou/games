# Cloudflare hosting and friend invitations

The collection runs on a Cloudflare Worker with Static Assets. Friend rooms, their chat and their games run in the `SignalRoom` Durable Object on the same origin. AI keys never leave the browser that configured them.

## Account setup

1. Create or choose a Cloudflare account.
2. In **Workers & Pages**, create or use the Worker named **games** and connect the GitHub repository. The checked-in `wrangler.jsonc` must match this name.
3. Set repository root to `/`, production branch to `main`, build command to **`npm run build`**, and deploy command to **`npx wrangler deploy`**. Cloudflare installs the root dependencies from `package-lock.json`; the build installs and compiles Nonocube and assembles `_site`. Leave non-production branch builds disabled until the first production deployment has created the Durable Object bindings.
4. After this PR is merged, Cloudflare builds and deploys `games` on a push to `main`. Its address is `https://games.<your-workers-subdomain>.workers.dev`. A custom domain can be added in **Workers & Pages → games → Settings → Domains & Routes**.
5. In GitHub **Settings → Pages**, disable GitHub Pages after the Cloudflare site is verified. This PR replaces the Pages deployment workflow.

GitHub Actions validates tests and the Cloudflare build on each PR. Require these checks before merging if production deployments should always use checked code. Cloudflare Git builds owns deployment; GitHub Actions does not need a Cloudflare API token.

Never set the asset directory to `.`: that publishes repository and developer files and can include `.git` pack files exceeding Cloudflare's 25 MiB asset limit. The checked-in asset directory is `_site`.

## Local development

```sh
npm ci
npm --prefix nonocube ci
npm run build
npm run dev
```

Use Wrangler's local site for automatic invitations. Each game's original development server supports offline play. Use Wrangler for global invitations and saved turn games.

## Deploy manually

```sh
npx wrangler login
npm run build
npm run deploy
```

No Cloudflare credentials are needed for local tests or `npm run deploy:check`.

## Optional managed TURN relay

Room games and chat never need a relay. Shared cursors open a direct WebRTC connection; configure the managed relay for players on networks that block it:

1. Open Cloudflare **Realtime → TURN**, and create a TURN key.
2. In **Workers & Pages → games → Settings → Variables and Secrets**, add `TURN_KEY_ID` with the key's ID and add **secret** `TURN_API_TOKEN` with that TURN key's API token. This is the token issued for the TURN key, not the general Cloudflare account API token.
3. Deploy the updated configuration. No values belong in GitHub, the invitation URL, the game's settings or browser JavaScript.

The Worker generates credentials valid for one hour, limited to twelve requests per hour per seat in a friend room (four for legacy invitations). They remain in browser memory. A manually configured relay takes precedence. Sessions longer than the credential lifetime need a fresh connection.

The `SignalRoom` and `InviteLimiter` Durable Object bindings are created automatically by the checked-in Wrangler migration; do not create KV namespaces, D1 databases, Pages projects or manual bindings. SQLite-backed Durable Objects work on the Workers Free plan.

## Friend rooms and saved games

Each open page keeps one WebSocket to its room's `SignalRoom` Durable Object, using the WebSocket Hibernation API, so idle pages cost no duration. The room pushes friend presence and display names, chat, and role-private game views; moves, chat and names are sent as ordinary HTTP requests and validated in the object. Each socket message counts as a twentieth of a request, and a page sends a presence heartbeat every 45 seconds, well within the Workers Free plan for two friends.

Invitations come from the Play together window: the room is created first, then shared as an eight-character code or link. Codes expire after 24 hours, admit only the unclaimed guest seat and are origin-scoped; lookups are limited to 30 attempts per hour per IP. The expiring code registry uses the existing InviteLimiter namespace. An unclaimed room initially expires after 15 minutes. Claiming a private browser seat extends retention to 90 days after the most recent authenticated visit.

Flip It, Cluance, Midnight Table, Thrice, Yesteryear, Cover Story and Ripples run on the server (`cloudflare/turn-games.js`), so either browser can be offline. Every move is validated and responses contain only that player's allowed view. Rules bots play in the room; AI players are chosen in the creator's browser. Chat's latest 60 entries are also kept in the room. No new bindings, migrations or secrets are required. See [playing with a friend](FRIEND_SESSIONS.md).

Shared cursors are offered to the friend through the room and then use a direct WebRTC connection, signaled through the same Durable Object, for game state and input. Clearing browser storage loses that seat's private resume credential.

## Branch previews

Cloudflare automatically builds non-production branches, including pull requests, with isolated [Worker Previews](https://developers.cloudflare.com/workers/previews/). In **Workers & Pages → games → Settings → Builds → Previews Base**, enable **Builds for Preview branches**, set build command to **`npm run build`**, preview command to **`npx wrangler preview`**, and root to **`/`**. Keep production builds on `main` with `npx wrangler deploy`. Enable Preview URLs under **Domains & Routes** if the dashboard prompts for it.

Each push updates the branch's preview URL. Cloudflare's GitHub check and PR comment provide the URL so reviewers can play the branch before merging. Existing PR branches must include the current hosting files and `previews` configuration (merge `main` into older branches), then receive a new push to start a build. A PR created from a fork may require additional access or a branch in this repository.

The checked-in `previews.durable_objects.bindings` config gives each preview its own `SignalRoom` and `InviteLimiter` namespaces and storage. Static assets are built from that branch. The site builder discovers top-level game folders with an `index.html`, so PRs that add games also include those games in their previews. Preview invitations and quotas are isolated from production and other previews; invitation links must be opened on the same preview origin. Production secrets are not inherited. If managed TURN is needed in previews, configure separate preview credentials in **Previews Base**.

To deploy the current branch's preview manually after logging into Cloudflare:

```sh
npm run build
npm run preview
```

Use Wrangler 4.135.0 or newer; the repository pins a compatible release.

## Verification

`npm run test:cloudflare` checks permissions, origin isolation, expiry, signaling, TURN, live room presence and pushes, idempotent seat recovery, durable private game views, room bots and AI seats, stale/concurrent moves and chat. `npm run build` and `npm run deploy:check` validate assets and Worker bindings.

With Wrangler running locally, `npm run test:cloudflare:ui` checks two independent browsers: room-code join with names, persistent game requests, pushed moves, hidden-tab alerts, closed-tab play, chat, room bots, phone layout, leaving and shared cursors. Install Playwright separately or set `PLAYWRIGHT_MODULE` to its module path; `CHROMIUM_PATH` chooses a system browser. `GAMES_URL` overrides `http://127.0.0.1:8787`. Shared cursors use a deterministic RTC substitute with real Worker signaling; deployed cross-network connectivity needs relay/network verification.
