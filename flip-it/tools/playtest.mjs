import {createMatch, applyAction, playerView, assertState} from '../src/rules.js';
import {botAction} from '../src/bot.js';

// Reproducible public-information dealer play across every option combination.
// This measures the prototype; it is not evidence of human skill balance.
for (let config = 0; config < 8; config++) {
  const options = {quickTurns: !!(config & 1), compactDeck: !!(config & 2), lastChance: !!(config & 4)};
  const wins = [0, 0]; let draws = 0, moves = 0, longest = 0;
  for (let seed = 1; seed <= 50; seed++) {
    let state = createMatch(options, seed);
    while (state.phase === 'playing') {
      state = applyAction(state, state.turn, botAction(playerView(state, state.turn)));
      assertState(state);
    }
    if (state.result.winner === null) draws++; else wins[state.result.winner]++;
    moves += state.moves; longest = Math.max(longest, state.moves);
  }
  console.log(JSON.stringify({options, rounds: 50, wins, draws, averageMoves: moves / 50, longest}));
}
