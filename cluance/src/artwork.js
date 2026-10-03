// Full redraws keyed by subject keep overlapping themes visually consistent.
const portraitAtlas = 'assets/redesigns-people.webp';
const mixedAtlas = 'assets/redesigns-mixed.webp';
export const ART_OVERRIDES = Object.fromEntries([
  ...['Clovis', 'Mansa Musa', 'Ibn al-Haytham', 'Marie Curie', 'Homer', 'Diogenes'].map((name, atlasIndex) => [name, {atlas: portraitAtlas, atlasIndex, columns: 3, rows: 2}]),
  ...['Kenya', 'Cronus', 'Pandora', 'Beijing'].map((name, atlasIndex) => [name, {atlas: mixedAtlas, atlasIndex, columns: 2, rows: 2}]),
]);

