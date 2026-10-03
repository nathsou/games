// A small opening book so stronger opponents start like real players.
const LINES = [
  'e2e4 e7e5 g1f3 b8c6 f1c4 f8c5 c2c3 g8f6 d2d3 d7d6',
  'e2e4 e7e5 g1f3 b8c6 f1c4 g8f6 d2d3 f8c5 c2c3 d7d6',
  'e2e4 e7e5 g1f3 b8c6 f1b5 a7a6 b5a4 g8f6 e1g1 f8e7',
  'e2e4 e7e5 g1f3 b8c6 d2d4 e5d4 f3d4 g8f6 d4c6 b7c6',
  'e2e4 e7e5 g1f3 g8f6 f3e5 d7d6 e5f3 f6e4 d2d4 d6d5',
  'e2e4 e7e5 b1c3 g8f6 g1f3 b8c6 f1b5 f8b4',
  'e2e4 c7c5 g1f3 d7d6 d2d4 c5d4 f3d4 g8f6 b1c3 a7a6',
  'e2e4 c7c5 g1f3 b8c6 d2d4 c5d4 f3d4 g8f6 b1c3 e7e5',
  'e2e4 e7e6 d2d4 d7d5 b1c3 g8f6 c1g5 f8e7',
  'e2e4 c7c6 d2d4 d7d5 b1c3 d5e4 c3e4 c8f5 e4g3 f5g6',
  'e2e4 d7d5 e4d5 d8d5 b1c3 d5a5 d2d4 g8f6',
  'd2d4 d7d5 c2c4 e7e6 b1c3 g8f6 c1g5 f8e7 e2e3 e8g8',
  'd2d4 d7d5 c2c4 c7c6 g1f3 g8f6 b1c3 d5c4',
  'd2d4 g8f6 c2c4 e7e6 b1c3 f8b4 e2e3 e8g8',
  'd2d4 g8f6 c2c4 g7g6 b1c3 f8g7 e2e4 d7d6 g1f3 e8g8',
  'd2d4 d7d5 g1f3 g8f6 c1f4 e7e6 e2e3 f8d6',
  'c2c4 e7e5 b1c3 g8f6 g1f3 b8c6 g2g3 d7d5',
  'g1f3 d7d5 d2d4 g8f6 c2c4 e7e6 b1c3 f8e7',
].map(l => l.split(' '));

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

export function bookMove(fen, moves, rand = Math.random) {
  if (fen.split(' ')[0] !== START.split(' ')[0]) return null;
  const options = [];
  for (const line of LINES) {
    if (line.length <= moves.length) continue;
    if (moves.every((m, i) => line[i] === m)) options.push(line[moves.length]);
  }
  if (!options.length) return null;
  return options[Math.floor(rand() * options.length)];
}
