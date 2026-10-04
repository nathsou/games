# Cloudflare hosting and friend invitations

The collection runs on a Cloudflare Worker with Static Assets. Flip It and Cluance use the same origin for automatic WebRTC signaling. Game state, private hands and AI keys stay in the existing peer session; the server only exchanges connection metadata.

## Account setup

1. Create or choose a Cloudflare account, and copy its **Account ID** from the dashboard.
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

Use Wrangler's local site for automatic invitations. Each game's original development server still supports offline play and manual pairing.

## Deploy manually

```sh
npx wrangler login
npm run build
npm run deploy
```

No Cloudflare credentials are needed for local tests or `npm run deploy:check`.

## Optional managed TURN relay

Signaling works without a TURN account. Configure the managed relay for players on networks that block direct WebRTC connections:

1. Open Cloudflare **Realtime → TURN**, and create a TURN key.
2. In **Workers & Pages → games → Settings → Variables and Secrets**, add `TURN_KEY_ID` with the key's ID and add **secret** `TURN_API_TOKEN` with that TURN key's API token. This is the token issued for the TURN key, not the general Cloudflare account API token.
3. Deploy the updated configuration. No values belong in GitHub, the invitation URL, the game's settings or browser JavaScript.

The Worker generates credentials valid for one hour, limited to four requests per seat in an authenticated invitation. They remain in browser memory. A manually configured relay takes precedence. Sessions longer than the credential lifetime need a fresh connection.

The `SignalRoom` and `InviteLimiter` Durable Object bindings are created automatically by the checked-in Wrangler migration; do not create KV namespaces, D1 databases, Pages projects or manual bindings. SQLite-backed Durable Objects work on the Workers Free plan.

## Invite behavior and limits

- Invite links expire after 15 minutes. Host and guest each have a distinct random capability; the shared link contains only the guest capability, in its fragment.
- Both games exchange SDP and ICE automatically. Gameplay, private cards and AI credentials use the existing encrypted WebRTC data channel.
- The service accepts only two seats and connection metadata. It limits each IP to 30 new invitations per hour, caps signaling size/rate, and discards buffered connection metadata after connection or expiry.
- A link already used for a completed connection cannot be reused. Keep both game tabs open; reconnecting makes a fresh link while preserving the existing game's recovery behavior.
- Cluance keeps the inviter's chosen giver/guesser role and public table options. Flip It defaults to a duel with zero bots/AI.
- **Use manual pairing** provides the original invite/reply flow if needed. Manual pairing and local games remain available on the games' original development servers.

## Branch previews

After the first production deployment creates the Durable Object migrations, Cloudflare's non-production deploy command can be set to `npx wrangler versions upload` to create preview URLs. Those versions share the production Durable Object namespaces. Rooms are bound to their exact origin, preventing an invitation from being used on another preview or production host. Use a separate Worker/account environment if you need fully isolated preview quotas and storage.

## Verification

`npm run test:cloudflare` uses Cloudflare's local runtime to check room permissions, origin/game isolation, expiry, replay/duplicate-seat rejection, signaling limits and TURN credential minting. `npm run build` and `npm run deploy:check` validate the complete collection and Worker bindings. Browser audits cover automatic invite exchange in both games; credentials and remote-network connectivity still require account configuration.
