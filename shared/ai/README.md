# Shared card-game AI

Flip it, Similo and all three Midnight Table games use one provider client, configuration store and usage ledger. No SDK, package, backend or extra runtime dependency is needed. OpenAI uses Responses with `store: false` and strict JSON schemas; OpenRouter uses Chat Completions, and Anthropic uses Messages. Provider-specific model and effort preferences remain independently configurable. Unsupported combinations report an error without substitution.

`config.js` reads the collection-wide settings and migrates Similo's previous settings. Remembered keys are opt-in. Unremembered keys remain in module memory until the tab closes/reloads; they do not move to another game page. Remembered settings synchronize through browser storage events. Keys are excluded from game snapshots, invites, AI observations, replays and spending history. Forgetting keys clears both the new store and migrated legacy credentials. If browser storage is denied, settings and usage remain available for the current visit.

`client.js` handles provider requests, model catalogs, role-specific optional images, response extraction and key-redacted errors. `turn.js` chooses an index from a supplied legal candidate list. Invalid responses get one correction request; illegal output never mutates a game. Similo preserves its own detailed decision schema and role validation while using this transport. Each game has timeout, pause and retry controls. Configuration never includes a game state.

`usage.js` records returned token counts, reasoning/cache tokens, status and estimated/reported spending for every request. It preserves old Similo history. Provider pricing preferences and the existing Similo spending panel apply to all card games. Cancelled requests may still be billed even if no response arrives. Completed card-game turns include a revision so multiple moves in one round are counted separately. Brief model rationales stay in the owning seat's game memory and do not enter the usage ledger or peer messages.

## Information and prompts

Flip it supports two to five seats: separate human browsers can play against each other with up to three extra model/dealer opponents, or share a hand against up to four opponents. Only the host calls providers. Each prompt receives that AI seat's own hand, public sets/history, hidden hand counts, and its own prior brief explanations. Candidate annotations give exact cash-outs and returns. The first empty hand retains priority throughout the other players' one-action Last Chance replies.

Midnight Table's simultaneous decisions capture redacted observations before the human locks a bid or defense. An opponent never receives another hand, guard, raid choice or future deck. Closing Time includes named ownership and exact public closing outcomes. Pocket Heist includes unspent alarm/bluff counts calculated solely from revealed defenses. Zero unspent alarms proves a concealed defense is a bluff. The offline dealer uses the same redacted boundary and excludes hidden replacement lots from lookahead.

## Live prompt iteration · 2026-10-03

Only **GPT-6-luna** was called for this task, using `low` reasoning and a 4,096 output-token budget. Runtime preferences still default to the existing Similo choices, which users may change.

1. Compared a rules prompt and a payoff/counter prompt across six tactical positions: **12/12 legal responses, 10/12 tactical passes**. Failures involved auction ownership and publicly exhausted alarms.
2. Added named ownership, exact public auction outcomes, explicit defense inventories, and pending-finisher priority: **6/6 legal responses and tactical passes**. This is a small tactical smoke test, not a general win-rate benchmark. Reports: [initial](EVALUATION.json), [refined](EVALUATION_REFINED.json).
3. Played complete browser games using direct provider calls: **65 calls across four completed games**. Flip it used 20; Backhand 9; Closing Time 26; Pocket Heist 10. No browser errors. The scripted human made simple legal choices; these results demonstrate functional play, not a competitive-strength ranking. [Live match report](LIVE_PLAYTEST.json).

The `.env` file requested by the user was denied direct filesystem access; the evaluator used the already available `OPENAI_API_KEY` process environment instead. The browser tests passed it to module memory with remembering disabled. No credential was printed, committed, or written into a report.

Run the optional live evaluator from the repository root:

```sh
OPENAI_API_KEY=… node shared/ai/tools/evaluate.mjs --refined-only
```

Alternatively, `--key-file /path/to/.env` reads only `OPENAI_API_KEY` when file permissions allow it. The evaluator is fixed to GPT-6-luna and writes token usage plus brief move explanations, never request headers or credentials. Every run makes six billed calls with `--refined-only`, or twelve without it.

## Validation

- All **104 automated checks passed**, including the existing Spacegolf suite. Deterministic rule/privacy tests cover all option combinations at 2–5 seats, multiple Last Chance replies, cross-seat targets, card conservation and redacted five-seat peer updates.
- Shared tests cover settings migration, memory-only/forgotten keys, schema payloads, one correction, key redaction, usage recording and redacted dealer playthroughs.
- Browser checks cover complete solo and real WebRTC matches, mixed model/dealer seats, team AI in every Midnight game, both Similo role/image requests, pause/retry without state changes, cross-tab settings and Light/Dark/System themes. The final suite completed ten browser scenarios with 199 mocked provider responses and no browser errors. Browser provider responses were mocked for these protocol/UI checks; the separate live matches above used the actual API. [Browser report](BROWSER_PLAYTEST.json), [recovery and Similo report](RECOVERY_PLAYTEST.json).
- Desktop/phone layouts checked at widths 320, 390, 768 and 1280 with no horizontal overflow.

Provider setup follows the official [GPT-6-luna model documentation](https://developers.openai.com/api/docs/models/gpt-6-luna) and [prompt guidance](https://developers.openai.com/api/docs/guides/prompt-engineering). UI themes live separately in `shared/theme.js` and `shared/theme.css`; Similo retains its existing display controls.
