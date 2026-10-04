# Clue directions and interpretation

Investigated during direct GPT-6 Luna play on 2026-10-03. No tests or automated suite were written.

## Why Different can be common

There is no code that converts the model's choice to Different. Both directions are legal in the response schema, and the giver's returned direction is passed to the game rules. The human's direction control initially selects Similar; that control does not select an AI move's direction.

The earlier prompt nevertheless encouraged repeated contrasts and said a specific visual match should outweigh a close profession label in the last round. Those instructions could favor negative clues and appearance. The removal task itself also makes a contrast feel like a direct instruction to eliminate, even though a positive connection can work equally well. These are plausible contributors, not a measurement of every player's experience.

A fixed five-card hand can lack a clear positive connection in the useful domain. In one reviewed Scientists position, Tesla's hand contained Émilie du Châtelet, Hypatia, Rosalind Franklin, Darwin and Pasteur. Darwin/Different separates biology from electrical engineering; a generic Scientist/Similar connection barely separates a board full of scientists. The choice can be useful without implying that negative clues should always be preferred.

## Observed directions

Three previously recorded complete AI-giver games—French History, Greek Mythology and Cities/Countries—contain 15 clues: **9 Similar and 6 Different**. That small local sample does not establish an overall distribution or contradict a player who encountered many negative clues in other deals.

The old and revised prompts were each sent the **same image, board, hand, secret, public descriptions, dates and effort** for three opening positions. Both chose Hephaestus/Similar for Hestia, China/Similar for Beijing, and Darwin/Different for Tesla. Each prompt therefore produced two positive clues and one negative clue in this comparison. The revised Tesla explanation described scientific domains, whereas the earlier one foregrounded a bird, natural landscape and electrical imagery. This demonstrates changed wording on that move, not proof of a new win rate or a guaranteed interpretation process.

A subsequent full French History fixed-hand game ended in a loss in round four with Joséphine Baker as the target. Its clues were Olympe de Gouges/Similar, Voltaire/Similar, Joan of Arc/Similar and Charlemagne/Different. The giver meant activism, opposition to intolerance, service to France and a contrast with medieval emperors. The human instead inferred eighteenth-century intellectuals and revolutionary politics. In particular, the Voltaire explanation compared the clue to Olympe rather than directly to Baker. This motivated direct target anchoring and a check for unintended patterns shared by several clues. Revisiting that same second-round position with the refined prompt chose Marie Antoinette/Different and an explicit contrast between a monarch and a performer/Resistance agent. No fresh full game was played from that alternative move, so it does not establish that the changed choice would win.

## Revised decision guidance

Every applicable dimension receives equal consideration: role and profession; dates, overlap and era; geography and culture; achievements, stories and relationships; context-supported traits; and illustration details. A candidate's clearest connection may still belong to one dimension. The prompt no longer prescribes a visual tie-breaker.

For each legal hand card, the giver considers both directions and compares plausible associations against the secret and all surviving alternatives. It checks the human's natural reading, safe removals for this round, cross-dimension ambiguity and consistency with earlier clues. A new clue must connect directly to the target; the accumulated clues are also checked for tempting era, profession, geography or appearance patterns that the target does not fit. The guesser similarly considers several possible interpretations and compares them against the whole trail. The giver observation explicitly includes the round's required elimination count.

Different requires a recognizable contextual contrast. Similar is not discouraged because the task involves removals. The prompt imposes no sign quota or mechanical alternation; an equally clear direct Similar association breaks an otherwise equal tie. Only the short explanation of the chosen move is recorded and revealed at the end, preserving the partner's information boundary.

Current provider guidance used: [GPT-6 Luna](https://developers.openai.com/api/docs/models/gpt-6-luna) and [OpenAI's GPT-6 prompting guidance](https://developers.openai.com/api/docs/guides/latest-model). Prompt behavior was checked with the selected Luna model rather than assuming another model's behavior transfers unchanged.

## Decision memory

Every request carries the full public clue/removal trail and the model’s own short explanations. Explicit `ownPreviousActions` records now pair each earlier AI move with its explanation: givers see their chosen clue and direction plus the public removals in response; guessers see their removals and the clue they received. Earlier sources are retained when the player changes models or effort. The prompt asks the model to preserve coherent associations and reconsider them after feedback. The partner’s sealed notes remain excluded, and a guesser never receives the target or private hand. This is recorded game memory, not a stored provider conversation or an internal reasoning transcript.


## Explicit keep/remove decisions and clue progression

A reported final round had Alexandre Dumas and Molière remaining, with La Fontaine/Different as the latest clue. The guesser's explanation identified Dumas as the clearer contrast with La Fontaine's era but its returned removal discarded Dumas. The engine applies the returned removal IDs directly; no inversion was found in that path. This is an action/explanation contradiction, although the complete earlier trail was not available to reconstruct the original game.

The previous generic `cards` output is replaced with explicit `keepCards` and `removeCards`. Both roles partition the surviving board; the giver's removal list is its prediction, while the guesser's list is the actual action. The lists must be disjoint, cover every survivor and have the required counts. The giver's prediction must keep the target safe. OpenAI's strict schema restricts card IDs to the active board and clue IDs to the current hand. All providers pass through the same local validation before a move is applied; an invalid response uses the existing single correction attempt and paid-attempt accounting.

The guesser is instructed to decide which cards stay first, explain both sides explicitly in the final round, and ensure that the names and IDs agree. Different describes the target's contrast with the clue; it does not mean discarding the candidate that provides the strongest contrast. Structural checks cannot prove that free-text explanations or interpretations are semantically correct, and models can still choose the wrong interpretation.

Each removed-card ID also has one brief factual explanation, checked for complete coverage and unique IDs. The giver must explain why that alternative fits its selected card/direction less well than the target; a feature shared equally by both cannot justify the removal. These explanations describe the selected move, rather than recording exploratory deliberation.

Giver predictions, per-card explanations and the dimensions supporting each move are recorded when the move is made, sealed during play, and shown beside actual removals in the final reveal. Guesser decisions also record the chosen keep list. Each model receives only its own earlier intentions, choices, dimensions and explanations, alongside public feedback. Predictions and dimension labels are excluded from active public views, multiplayer state and the partner's AI observation. Older saved games and replays need no migration; missing predictions are labelled as unrecorded.

The prompt now evaluates what a clue adds among the current survivors. It encourages complementary era, role, geography, story, trait and visual connections, including several readings that converge on the same safe removal. Compatibility with the target does not make a single dimension the theme of every round. Repetition remains appropriate when it still resolves ambiguity; there is no dimension quota.

Provider references: [Structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs) and [prompt engineering](https://developers.openai.com/api/docs/guides/prompt-engineering). Schema validity and sensible gameplay are separate concerns.
