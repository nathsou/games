import {aiObservation, remaining, REMOVALS, DIMENSIONS, validRemovalReasons} from './game.js';
import {beginUsage, finishUsage, markUsage} from './usage.js';

import {PROVIDERS, headers, request, buildProviderRequest, responseText} from '../../shared/ai/client.js';
export {PROVIDERS, headers, listModels} from '../../shared/ai/client.js';
export function parseMove(text) {
  const invalid = message => Object.assign(new Error(message), {code:'INVALID_MOVE'});
  if (typeof text !== 'string' || text.length > 50000) throw invalid('The model did not return a usable move.');
  const clean = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  let move;
  try { move = JSON.parse(clean); } catch { throw invalid('The model returned invalid JSON.'); }
  if (!move || typeof move !== 'object' || typeof move.rationale !== 'string' || !move.rationale.trim() || move.rationale.length > 1200) {
    throw invalid('The model must return a move with a brief explanation.');
  }
  return move;
}
function moveSchema(observation) {
  const active = observation.board.filter(card => !card.eliminated).map(card => card.id);
  const giver = observation.role === 'giver';
  return {type:'object', properties:{
    card: giver ? {type:'string',enum:observation.hand.map(card => card.id)} : {type:'null'},
    relation: giver ? {type:'string',enum:['similar','different']} : {type:'null'},
    keepCards:{type:'array',items:{type:'string',enum:active}},
    removeCards:{type:'array',items:{type:'string',enum:active}},
    dimensions:{type:'array',items:{type:'string',enum:DIMENSIONS}},
    removalReasons:{type:'array',items:{type:'object',properties:{card:{type:'string',enum:active},rationale:{type:'string'}},
      required:['card','rationale'],additionalProperties:false}},
    rationale:{type:'string'}},
    required:['card','relation','keepCards','removeCards','dimensions','removalReasons','rationale'],additionalProperties:false};
}
function validateDecision(move, game, role) {
  const invalid = message => {throw Object.assign(new Error(message), {code:'INVALID_MOVE'});};
  const active = remaining(game), count = REMOVALS[game.round];
  const validList = ids => Array.isArray(ids) && new Set(ids).size === ids.length && ids.every(id => active.includes(id));
  if (!validList(move.keepCards) || !validList(move.removeCards) || move.removeCards.length !== count ||
      move.keepCards.length !== active.length - count || move.keepCards.some(id => move.removeCards.includes(id))) {
    invalid(`Return exactly ${count} removeCards and ${active.length - count} keepCards. They must be disjoint and cover all surviving IDs. Keep means stays on the table; remove means discarded.`);
  }
  if (!Array.isArray(move.dimensions) || !move.dimensions.length || move.dimensions.length > DIMENSIONS.length ||
      new Set(move.dimensions).size !== move.dimensions.length || move.dimensions.some(value => !DIMENSIONS.includes(value))) {
    invalid('Name the applicable dimensions that support this decision.');
  }
  if (!validRemovalReasons(move.removalReasons, move.removeCards)) {
    invalid('Give one short factual removalReasons entry for each removeCards ID, with card and rationale (1–300 characters).');
  }
  if (role === 'giver') {
    if (!game.hand.includes(move.card) || !['similar','different'].includes(move.relation)) invalid('Choose one legal hand card and direction.');
    if (!move.keepCards.includes(game.secret)) invalid('Your expected removals would discard the secret. Choose a safer clue and prediction.');
    return {...move, cards:[], expectedRemovals:move.removeCards};
  }
  if (move.card !== null || move.relation !== null) invalid('As guesser, return card=null and relation=null.');
  return {...move, cards:move.removeCards, keptCards:move.keepCards};
}
export function buildRequest(settings, observation, image, correction = '') {
  const provider = settings.provider, model = settings.models[provider], effort = settings.efforts[provider];
  const schema = moveSchema(observation);
  const rules = `You are playing cooperative Cluance with a human. Respect your role's information boundary and return one legal move.
GAME: Twelve cards, one secret, five rounds. The giver plays ONE hand card as SIMILAR (a shared feature) or DIFFERENT (a specific contrast). The guesser removes 1, 2, 3, 4, then 1 cards; removing the secret loses, keeping it alone wins. All previous clues remain relevant. A fixed hand never refills: plan the order of all remaining cards. A classic hand refills after each clue. Do not browse or use tools.
SHARED CONTEXT: Use the supplied image AND the public subtitles, dates and descriptions; the human can inspect the same context. Give equal consideration to every applicable dimension, with no automatic priority for looks or profession. Dimensions: (1) job, role or domain, such as emperor, scientist, writer or performer; (2) dates, lifespan overlap, historical era and contemporaries; (3) geography, origin, country and cultural setting; (4) known achievements, stories, relationships, beliefs or mythological associations; (5) traits and categories explicitly supported by the context; (6) appearance, clothing, props, colors, architecture and landscape. Consider all six before choosing; some may be inapplicable. Use the most clear and discriminating connection in this position. Neither a matching portrait nor a job label automatically outranks a clear chronological or thematic connection. Art is stylized: do not infer an exact age, ethnicity, character or biography from a face. Profession labels are incomplete: a computing pioneer can also be a mathematician. Avoid obscure trivia and unsupported psychological traits.
DATES: Unlabelled ranges are lifespans; Born, Reign and named landmarks/events/milestones have their stated meanings. c. is approximate; Trad. is traditional. Mythical figures have no historical lifespans. A country's milestone is not its founding or the beginning of its culture; a monument's date is not a city's entire era. Regional boundaries can be administrative; a reform or department-status date does not date the older regional culture. Use each region card's supplied context. Do not invent connections or visual details.
PRIVATE INFORMATION: Givers receive the secret and hand; guessers receive neither. Your ownPreviousActions records include your earlier moves, chosen clue directions or removals, public responses, and short explanations. Use this decision history alongside the public clue trail to preserve coherent associations and reconsider choices after feedback. You receive only your OWN earlier short explanations as memory, never the partner's sealed notes. Reconsider your earlier interpretation when later evidence changes it. Your rationale, intended removals and selected dimensions are sealed until the game ends: the human only sees the card and its direction during play. Compare your earlier intended removals with the actual public response; an unexpected response suggests the human interpreted the clue differently.
GIVER DECISION: For EACH legal hand card, consider BOTH Similar and Different. Compare its possible connections across the six dimensions with the secret and ALL surviving alternatives. For each plausible candidate, check: what is the human's natural reading; does the target fit that reading; which alternatives would it invite them to remove this round; could another dimension make it confusing or point away from the target; does it fit the whole clue trail? Anchor each new clue directly to the secret, not merely to an earlier clue. Check accumulated unintended patterns: if several clues share an era, job, geography or visual trait that the target lacks, would the human reasonably infer that pattern instead of your intended association? Avoid adding to a dangerous pattern unless the public clue trail clearly protects the target. Discard candidates whose most obvious reading endangers the target. Compare a few promising card/direction pairs before selecting the clearest. A broad role such as emperor or scientist is useful when it actually separates this board; a visual detail is useful under the same condition. Familiar geography, dates and stories are equally valid.
GIVER CLUE PROGRESSION: Judge the extra discrimination each clue adds among TODAY'S survivors. A clue that merely repeats an already established era, role, geography or look is weak if it protects the same alternatives. Look for complementary connections: for example role narrows the group, then dates, geography or a recognizable story separates the remaining peers. A clue may support more than one relevant dimension when those readings converge on safe removals; prefer that robustness over a fragile single association. Do not require every trait to agree with every clue: different rounds can refer to different traits. Maintain compatibility with the target without treating one dimension as the permanent theme. Repeating a trait is appropriate when it still removes ambiguity or is the clearest safe option; do not force diversity, obscure connections or sign alternation.
GIVER ELIMINATION CONTRAST: For each predicted removal, identify a concrete public feature that makes it less plausible than the target under this card and direction. For Similar, the target shares the selected feature more clearly than that alternative. For Different, the alternative matches the clue on the selected feature more closely than the target does. A feature shared equally by the target and alternative cannot justify removing that alternative. If all survivors are 19th-century European writers, another 19th-century European writer alone does not justify any removal; compare finer dates, geography, genres, stories or visible details, or choose a different clue/direction. Do not protect an alternative using a country, gender or story that the target lacks. Check your claimed contrasts against every named card's supplied context. If you cannot explain the required number of safe removals for this move, reconsider the candidate or direction rather than inventing differences.
SIGN CHOICE: Similar and Different are equally legal. Do not default to Different because the task involves eliminating cards, or assume that repeated negative clues are desirable. A positive shared feature can guide safe eliminations just as well. A Different clue must communicate a concrete, recognizable opposing feature that the target fits, not just absence of an arbitrary similarity. Check for dangerous shared traits that could make its direction ambiguous. Choose the best signal; do not force a sign quota or alternate signs mechanically. When two moves are equally clear and safe, prefer a direct Similar connection, which requires less guessing about the intended contrast. With fixed five, reserve a useful final discriminator without sacrificing the current round or contradicting earlier clues.
GUESSER DECISION: Compare every remaining card against the whole clue trail through the same six dimensions. Consider several plausible meanings of the latest clue and check each against geography, dates/era, role, stories, traits and appearance. Ask which interpretation best explains the giver's choice and separates this board without conflicting with earlier clues. Similar means at least one relevant shared feature, not agreement in everything. Different means one contextual contrast, not a prohibition on every shared feature. Keep the candidates that best fit the combined evidence and remove the least plausible exactly as required. In the final round, directly contrast the two survivors against the latest clue in every applicable dimension, using the enlarged portraits and public biographies equally. Do not automatically resolve a tie by looks. Never claim to know the hidden secret. Decide which candidates STAY first, then list the discarded complement. Different describes the target's contrast WITH THE CLUE, not an instruction to discard the card that is different. If a candidate's era or role makes it the better fit for a Different clue, KEEP that candidate. In the final round name the one card to keep and the one to remove explicitly in your short explanation, and check that those names agree with the IDs. A sentence explaining why a candidate is the better fit must never be used to justify removing it.
OUTPUT: Return ONLY one JSON object with exactly {"card":string|null,"relation":"similar"|"different"|null,"keepCards":string[],"removeCards":string[],"dimensions":string[],"removalReasons":[{"card":string,"rationale":string}],"rationale":string}. Use the exact IDs in the observation. keepCards means cards that remain on the table; removeCards means cards discarded. The two lists must be disjoint and together contain EVERY surviving board ID exactly once; removeCards must have exactly requiredEliminations IDs. Giver: card is one hand ID, relation is its direction; removeCards records the specific alternatives you EXPECT the human to remove from this clue, and keepCards must include the secret. These are predictions, not actions imposed on the human. Guesser: card=null, relation=null; keepCards and removeCards are your actual decision. dimensions names only the dimensions supporting this move, from ["role","dates","geography","stories","traits","appearance"]. removalReasons contains exactly one entry for each removeCards ID: a brief factual, player-facing explanation (one sentence, at most 240 characters) of why you expect to remove that card (giver) or chose to remove it rather than the kept alternatives (guesser). For givers, compare it with the target; merely naming a genre or era shared equally by both is insufficient. These are concise explanations of the selected move, not exploratory deliberation. Record a short player-facing rationale (1–3 sentences, at most 800 characters) naming the association, why it separates the candidates, and which named cards you expect to remove (giver) or choose to keep/remove (guesser). Ensure the explanation agrees with both lists. This is a brief end-of-game explanation, not a transcript of internal deliberation. Do not mention a hidden target when guessing. ${correction}`;
  return buildProviderRequest(settings, rules, 'Your observation:\n' + JSON.stringify(observation), schema, 'cluance_move', image);
}

export async function chooseMove(settings, game, role, image, signal, correction = '') {
  const provider = settings.provider;
  const key = settings.keys[provider];
  if (!key) throw new Error(`Add your ${PROVIDERS[provider].name} key in Settings first.`);
  const {url, body} = buildRequest(settings, aiObservation(game, role), image, correction);
  const usageId=beginUsage(game,role,settings);let data;
  try {data=await request(url, {method:'POST', headers:headers(provider,key), body:JSON.stringify(body), signal}, key);}
  catch(error){if(error.usageResponse)finishUsage(usageId,error.usageResponse);markUsage(usageId,signal?.aborted?'cancelled':'failed');throw error;}
  finishUsage(usageId,data);
  const text = responseText(provider, data);
  let move;
  try {move=validateDecision(parseMove(text),game,role);}catch(error){markUsage(usageId,'invalid');throw error;}
  markUsage(usageId,'completed');
  return {...move, usageId, source: `${PROVIDERS[provider].name} · ${settings.models[provider]} · ${settings.efforts[provider]} effort`};
}
