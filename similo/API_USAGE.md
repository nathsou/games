# Local API spending

The usage panel records games and requests on this browser/origin from the time this feature is used. It cannot retrieve earlier spending or account-wide billing. Entries contain game/deck identifiers, timestamps, provider/model/effort, token counts and captured rates. They contain no credentials, images, prompts, targets or sealed explanations. Replay imports do not add historical charges; revisiting a completed game does not duplicate its entries.

Every actual move request creates an entry before contacting the provider. A response's usage is recorded before move parsing, so an invalid JSON reply or illegal move still contributes its known cost. Each correction request has its own entry. Failed, cancelled or interrupted requests without usage remain unconfirmed rather than being silently counted as free. A total marked ≥ is the sum of known charges with at least one unconfirmed or unpriced entry. Older AI moves encountered in a resumed game also remain untracked rather than being backfilled as free.

Human games are recorded with zero AI requests. Game saves and the usage ledger are independent, so rematches and new games retain earlier spending. If storage is unavailable, the ledger stays in memory and the panel says that totals last only for the current visit.

## Provider accounting

- **OpenAI Responses:** input includes uncached input, cache reads and cache writes. Output already includes reasoning; reasoning is shown as a subset, never added a second time. Cost applies the captured input, cached-input, cache-write and output rates. GPT-6 Luna's verified standard rates are $0.10, $0.01, $0.125 and $0.50 per million respectively. Its documented long-context multipliers and a returned Fast/Priority or Flex service tier are accounted for.
- **Anthropic Messages:** the uncached `input_tokens` count is separate from cache reads and writes. Total input is their sum. Output already includes thinking tokens. Five-minute cache creation uses the captured write rate; a reported one-hour cache creation uses twice the base input rate. Claude Sonnet 4.6's verified rates are $3, $0.30, $3.75 and $15 per million respectively. The shipped game does not request explicit caching or a regional endpoint.
- **OpenRouter:** the returned `usage.cost` takes priority, including a legitimate zero. Native prompt/completion counts and cache/reasoning details supply the token breakdown. If a response omits cost, known or custom per-token rates can supply an estimate. Loading models can save catalog prices, but never overwrites a custom price. Deprecated `usage.include` options are unnecessary.

Defaults were verified on **2026-10-03**. Unknown models are not assigned another model's prices. Players can enter rates in Settings; omitted cache rates use the ordinary input rate for an estimate. Each request keeps the rates used when it began, so changing prices does not change previous estimates. Returned costs always override token-based estimates. Provider-specific discounts, taxes and activity outside this page are not included.

The optional five-round guide extrapolates the cost of completed turns in the current game. Later rounds, changed models/effort, cache behavior and corrections can change the result. It is a guide, not a budget enforcement mechanism.

## Sources

- [GPT-6 Luna pricing](https://developers.openai.com/api/docs/models/gpt-6-luna)
- [OpenAI output and reasoning usage](https://developers.openai.com/api/docs/guides/reasoning)
- [Anthropic pricing](https://platform.claude.com/docs/en/about-claude/pricing)
- [Anthropic Messages usage fields](https://platform.claude.com/docs/en/api/typescript/messages)
- [OpenRouter usage accounting](https://openrouter.ai/docs/cookbook/administration/usage-accounting)
