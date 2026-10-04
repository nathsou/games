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

The signaling and optional managed TURN configuration are being added in this PR.
