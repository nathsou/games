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
